//import https from 'node:https'
import { logger, qubicLiUser, db } from './config.js'


const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
const timeout = 30000

let response, result, token
try {
    let postData = JSON.stringify({ 'userName': qubicLiUser.login, 'password': qubicLiUser.password, 'twoFactorCode': '' })
    response  = await fetch('https://api.qubic.li/Auth/Login', {
        method: 'POST',
        body: postData,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': userAgent
        },
        timeout: timeout
    })

    result = await response.json()
    token = result.token

    if (!token) {
        logger.error(result, 'Error token')
    } else {

        /*
        miners: [
            {
            id: '1dfff512-a17a-4e6a-8489-2e3640303bb4',
            minerBinaryId: null,
            alias: 'admin.2680',
            version: [Object],
            outdatedVersion: false,
            lastActive: '2024-03-18T09:05:59.37',
            currentIts: 132,
            currentIdentity: 'OZLVNWQIXWVDYBSRZNIFARWFJDXAUTJSSWRXLWSQYEIGOXVZSSYTILNAXHQJ',
            solutionsFound: 0,
            threads: null,
            totalFeeTime: 0,
            feeReports: [],
            isActive: true
            }
        ],
        */
        response  = await fetch('https://api.qubic.li/My/MinerControl', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': userAgent
            },
            timeout: timeout,
        })
        result = await response.json()
        //console.log(result)

        if (result.miners) {
            let dbUsers = new Map() // [login, id]
            let dbWorkers = new Map() // [name, {id, user_id}]
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.each("SELECT name, id, user_id FROM workers", (err, row) => {
                        if (err) return reject(err)
                        dbWorkers.set(row.name, {id: row.id, userId: row.user_id})
                        resolve()
                    })
                    db.get("", function(err, row)  {
                        resolve(true)
                    }) 
                })
            })
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.each("SELECT id, login FROM users", (err, row) => {
                        if (err) return reject(err)
                        dbUsers.set(row.login, row.id)
                        resolve()
                    })
                    db.get("", function(err, row)  {
                        resolve(true)
                    }) 
                })
            })


            let stats = new Map() // [user.worker, [user, worker, its, sol, lastActive, isActive]]
            let newWorkers = [] // [user.worker]
            for(let item of result.miners) {
                const alias = item.alias.trim().toLowerCase().split('.', 2)
                if (alias[0] && alias[1]) {
                    const id = item.id
                    const user = alias[0].trim()
                    const worker  = alias[1].trim()
                    const workerName= user + '.' + worker
                    const its = parseInt(item.currentIts) 
                    const sol = parseInt(item.solutionsFound)
                    const lastActive = item.lastActive
                    const isActive = item.isActive ? 1 : 0

                    if (dbUsers.has(user)) {
                        if (newWorkers.indexOf(workerName) == -1 && !dbWorkers.has(workerName)) {
                            newWorkers.push(workerName)
                        }
                        if (stats.has(workerName)) { // repeat user.worker
                            if (isActive) {
                                let statItem = stats.get(workerName)
                                statItem.sol += sol
                                statItem.its += its
                                stats.set(workerName, statItem)
                            }
                        } else {
                            stats.set(workerName, { its: its, sol: sol, lastActive: lastActive, isActive: isActive})
                        }
                    } else {
                        logger.warn(item, 'Worker and such user do not exist')
                    }
                } else {
                    logger.warn(item, 'Incorrect alias')
                }
            }

            if (newWorkers) {
                await new Promise((resolve, reject) => {
                    db.serialize(() => {
                        // new workers
                        const stmt = db.prepare("INSERT INTO workers(name, user_id) VALUES (?,?)")
                        for(let worker of newWorkers) {
                            stmt.run(worker, dbUsers.get(worker.split('.')[0]))
                        }
                        stmt.finalize(err => { if (err) return reject(err) })
                        resolve(true)
                    })
                })
            }

            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    const datetime = parseInt(Date.now() / 1000) // Unix time
                    const stmt = db.prepare("INSERT INTO workers_statistics(worker, last_active, date_time, its, sol, is_active) VALUES (?,?,?,?,?,?)")
                    stats.forEach((item, key) => {
                        stmt.run(key, item.lastActive, datetime, item.its, item.sol, item.isActive)
                    });
                    stmt.finalize(err => { if (err) return reject(err) })
                    resolve(true)
                })
            })

            /*console.log(dbUsers)
            console.log(dbWorkers)
            console.log(newWorkers)
            console.log(stats)*/
        } else {
            logger.error(result, 'Error no miners')
        } 
    }

} catch (err) {
    logger.error(err);
}


db.close()