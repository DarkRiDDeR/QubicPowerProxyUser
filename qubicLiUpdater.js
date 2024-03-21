import { qubic } from './config.js'
import { logger, connectDB, getPasswordHash } from './functions.js'

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0'
const timeout = 30000
let serverData = ''
let response, result, token

try {
    if (qubic.specificDataServer) {
        response  = await fetch(qubic.specificDataServer, {
            headers: {
                'User-Agent': userAgent
            },
            timeout: timeout
        })
        serverData = await response.json()
    } else {
        let postData = JSON.stringify({ 'userName': qubic.login, 'password': qubic.password, 'twoFactorCode': '' })
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
            serverData = await response.json()
            serverData = serverData.miners
        }
    }




    if (serverData) {
        const db = connectDB()
        let dbUsers = new Map() // [login, id]
        let dbWorkers = new Map() // [user_id.name, id]
        const execGetDbUsers = () => {
            dbUsers = new Map()
            return new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.each("SELECT id, login FROM users", (err, row) => {
                        if (err) return reject(err)
                        dbUsers.set(row.login, row.id)
                    })
                    db.get("", function(err, row)  {
                        resolve(true)
                    }) 
                })
            })
        }
        const execGetDbWorkers = () => {
            dbWorkers = new Map()
            return new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.each("SELECT name, id, user_id FROM workers", (err, row) => {
                        if (err) return reject(err)
                        dbWorkers.set(row.user_id + '.' + row.name, row.id)
                        resolve()
                    })
                    db.get("", function(err, row)  {
                        resolve(true)
                    }) 
                })
            })
        }
        await execGetDbUsers()

        let stats = new Map() // [user.worker, [user, worker, its, sol, lastActive, isActive]]
        let poolUsers = new Set() 
        let poolWorkers = new Map() // [user.worker, [user, worker]]
        for(let item of serverData) {
            let alias = item.alias.trim().toLowerCase().split('.', 2)
            let worker = alias[0].trim()
            let user = 'none' // no detect user
            if (alias.length > 1) {
                user = worker
                worker  = alias[1].trim()
            }
            const userWorker = user + '.' + worker
            const its = parseInt(item.currentIts) 
            const sol = parseInt(item.solutionsFound)
            const lastActive = item.lastActive
            const isActive = item.isActive ? 1 : 0

            poolUsers.add(user)
            poolWorkers.set(userWorker, [user, worker])

            if (stats.has(userWorker)) { // repeat user.worker
                if (isActive) {
                    let statItem = stats.get(userWorker)
                    statItem.sol += sol
                    statItem.its += its
                    stats.set(userWorker, statItem)
                }
            } else {
                stats.set(userWorker, { user, worker, its, sol, lastActive, isActive})
            }
        }
        let newUsers = [...dbUsers.keys()]
        newUsers = [...poolUsers].filter(i => !newUsers.includes(i))

        if (newUsers) {
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    const stmt = db.prepare("INSERT INTO users (login, password, wallet) VALUES (?,?,?)")
                    let lastUser = ''
                    for(let user of newUsers) {
                        lastUser = user
                        stmt.run(user, getPasswordHash(user), '')
                    }
                    stmt.finalize(err => { if (err) return reject([err, lastUser]) })
                    resolve(true)
                })
            })
            await execGetDbUsers()
        }

        // workers
        await execGetDbWorkers()
        let newWorkers = [...poolWorkers.values()].filter(item => {
            return !dbWorkers.has(dbUsers.get(item[0]) + '.' + item[1])
        })
        //newWorkers.push(['balakin', '2680dual'])
        if (newWorkers) {
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    const stmt = db.prepare("INSERT INTO workers(user_id, name) VALUES (?,?);")
                    let lastWorker = ''
                    for(let worker of newWorkers) {
                        lastWorker = worker
                        stmt.run(dbUsers.get(worker[0]), worker[1])
                    }
                    stmt.finalize(err => { if (err) return reject([err, lastWorker]) })
                    resolve(true)
                })
            })
        }

        await new Promise((resolve, reject) => {
            db.serialize(() => {
                const datetime = parseInt(Date.now() / 1000) // Unix time
                const stmt = db.prepare("INSERT INTO workers_statistics(user_id, worker_id, last_active, datetime, its, sol, is_active) VALUES (?,?,?,?,?,?,?)")
                stats.forEach(item => {
                    const userId = dbUsers.get(item.user)
                    const workerId = dbWorkers.get(userId + '.' + item.worker)
                    stmt.run(userId, workerId, item.lastActive, datetime, item.its, item.sol, item.isActive)
                });
                stmt.finalize(err => { if (err) return reject(err) })
                resolve(true)
            })
        })

        db.close()

        /*console.log({dbUsers})
        console.log({dbWorkers})
        console.log({newUsers})
        console.log({newWorkers})
        //console.log({poolWorkers})
        console.log(stats)*/
        
    } else {
        logger.error(serverData, 'Error: miners data')
    } 
} catch (err) {
    logger.error(err);
}

