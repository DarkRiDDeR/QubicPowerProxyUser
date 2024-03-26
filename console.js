import { argv } from 'node:process'
import { connectDB, getPasswordHash, dbCreateUser, getTimestampOfLastWednesday } from './functions.js'
import { stat } from 'node:fs'
import { match } from 'node:assert'

/*Launching the Node.js process as:
node process-args.js one two=three four 

Would generate the output:
0: /usr/local/bin/node
1: /Users/mjr/work/node/process-args.js
2: one
3: two=three
4: four */

const db = connectDB()
try {
    if (argv[2]) {
        const operation = argv[2].toLowerCase()
        if (operation == 'sql' && argv[3]) {
            await db.all(argv[3], [], function(err, rows)  {
                if(err) reject("Read error: " + err.message)
                else console.log(rows)
            })
        // login, password, wallet
        } else if (operation == 'adduser') {
            if (argv.length != 6 ) {
                console.error('Error: аdd user command "adduser <login> <password> <wallet>"')
                process.exit()
            }
            const r = await dbCreateUser(db, argv[3].toLowerCase(), getPasswordHash(argv[4]), argv[5])
            if (r) {
                console.log('Success')
            }

        // print data of users
        } else if (operation == 'users') {
            console.log(`ID    LOGIN    WALLET`)
            db.each(`SELECT * FROM users`, (err, row) => {
                console.log(`${row.id}    ${row.login}    ${row.wallet}`)
            })
        } else if(operation == 'calculate') {
            let dbUsers = new Map()
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.each("SELECT id, login FROM users", (err, row) => {
                        if (err) return reject(err)
                        dbUsers.set(row.id, row.login)
                    })
                    db.get("", function(err, row)  {
                        resolve(true)
                    }) 
                })
            })

            let startTime = parseInt(argv[3])
            let finishTime = parseInt(argv[4])

            if (!startTime)
                startTime  = getTimestampOfLastWednesday()
            if (!finishTime) 
                finishTime = startTime + 7 * 24 * 60 * 60 // plus epoch

            let stats = []
            let item = []
            let datetime = null
            let isInactive = false
            let is0Its = false
            // берём статистику для расчёта только когда все машины активны и майнят
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.each("SELECT worker_id, user_id, its, datetime, is_active FROM workers_statistics WHERE datetime >= ? and datetime <= ? ORDER BY datetime",
                    [startTime, finishTime], (err, row) => {
                        if (err) return reject(err)
                        
                        if (datetime === null) {
                            datetime = row.datetime
                        } else if (datetime != row.datetime) {
                            datetime = row.datetime
                            if (!isInactive && !is0Its) {
                                stats.push([datetime, item])
                            }
                            item = []
                            isInactive = false
                            is0Its = false
                        }
                        if (!row.is_active)
                            isInactive = true
                        if (!row.its)
                            is0Its = true

                        item.push({userId: row.user_id, its: row.its})
                    })
                    db.get("", function(err, row)  {
                        resolve(true)
                    }) 
                })
            })
            if (datetime && !isInactive && !is0Its) {
                stats.push([datetime, item])
            }
            //console.log(stats)
            /* stats
            1711098302,
            [
                { userId: '3', its: 56 },
                { userId: '4', its: 37 },
                { userId: '5', its: 40 },
                { userId: '4', its: 40 },
                { userId: '4', its: 43 },
                { userId: '7', its: 85 },
                { userId: '8', its: 54 },
                { userId: '9', its: 23 },
                { userId: '9', its: 64 },
                */
            // per second calculation
            console.log('-----------------------')
            console.log('Total of statistic rows = ' + stats.length)

            let firstItem = stats.shift()
            startTime = firstItem[0]
            finishTime = stats[stats.length - 1][0]
            const interval = finishTime - startTime + 1
            
            /*
            for(let s = startTime; s <= finishTime; s++) {
                if (firstItem[0] < s) {
                    firstItem = stats.shift()
                }
                for(let item of firstItem[1]) {
                    let it = item.its
                    if (its.has(item.userId)) {
                        it += its.get(item.userId)
                    }
                    its.set(item.userId, it)
                }
            }
            console.log(its)

            let itsProcent = []
            let sum = 0
            its.forEach((v, k) => {
                v = v / interval
                sum += v
                itsProcent.push([dbUsers.get(parseInt(k)), v])
            })
            itsProcent.sort((a, b) => a[0].localeCompare(b[0]))

            console.log('Interval = ' + new Date(startTime * 1000).toUTCString() + ' - ' + new Date(finishTime * 1000).toUTCString())
            console.log('Avg. total it/s = ' + Math.round(sum))
            console.log('-----------------------')
            for(let item of itsProcent) {
                console.log(item[0] + ' = ' + Math.round(item[1]) + ' it/s / ' + (Math.round(item[1] * 10000 / sum) / 100) + '%')
            }
            */
            
            // array of average percentage per second
            let itsProcent = new Map() // [userId, procent]
            let sum = 0
            for(let s = startTime; s <= finishTime; s++) {
                if (firstItem[0] < s) {
                    firstItem = stats.shift()
                }
                sum = 0
                for(let item of firstItem[1]) {
                    sum += item.its
                }
                for(let item of firstItem[1]) {
                    let it = item.its / sum
                    if (itsProcent.has(item.userId)) {
                        it += itsProcent.get(item.userId)
                    }
                    itsProcent.set(item.userId, it)
                }
            }
            // average of average percentage per second
            let sortNamePrctIts = []
            itsProcent.forEach((v, k) => {
                sortNamePrctIts.push([dbUsers.get(parseInt(k)), Math.round(v * 10000 / interval) / 100])
            })
            sortNamePrctIts.sort((a, b) => a[0].localeCompare(b[0]))

            console.log('Avg. total it/s = ' + Math.round(sum))
            console.log('Interval = ' + new Date(startTime * 1000).toUTCString() + ' - ' + new Date(finishTime * 1000).toUTCString())
            console.log('-----------------------')
            for(let item of sortNamePrctIts) {
                console.log(item[0] + ' = ' + item[1] + '%')
            }

        } else if (operation == 'workers') {

            if (operationValue == 'clear_statistics') {
                db.serialize(() => {
                    db.run(`DELETE FROM workers_statistics;`)
                    db.run(`VACUUM;`)
                })
            }
        } else {
            console.error('Error: incorrect arguments')
        }
    } else {
        console.error('Error: command not defined')
    }
} catch (err) {
    console.error(err);
}
db.close()