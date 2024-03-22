import { argv } from 'node:process'
import { connectDB, getPasswordHash, dbCreateUser } from './functions.js'

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
        // login, password, wallet
        if (operation == 'adduser') {
            if (argv.length != 6 ) {
                console.error('Error: аdd user command "add <login> <password> <wallet>"')
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
        } else if (operation == 'workers') {
            const operationValue = argv[3].toLowerCase()

            // процентный вклад в общую мощность. Рассчитывается из всех данных таблицы workers_statistics
            if (operationValue == 'calculate') {
                let stats = [] // user, datetime,
                let lastTime = null
                let itsOneTime = new Map() // [user, its]
                await new Promise((resolve, reject) => {
                    db.serialize(() => {
                        db.each("SELECT id, worker, date_time, its FROM workers_statistics WHERE is_active = 1", (err, row) => {
                            if (err) return reject(err)
                            console.log(row)
                            if (lastTime != row.date_time){
                                if (lastTime != null) stats.push([lastTime, itsOneTime])
                                lastTime = row.date_time
                                itsOneTime = new Map()
                            }
                            const user = row.worker.split('.')[0]
                            itsOneTime.set(user, row.its + (itsOneTime.has(user) ? itsOneTime.get(user) : 0))

                            resolve()
                        })
                        db.get("", function(err, row)  {
                            resolve(true)
                        }) 
                    })
                })
                stats.push([lastTime, itsOneTime])
                console.log(stats)

            } else if (operationValue == 'clear_statistics') {
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