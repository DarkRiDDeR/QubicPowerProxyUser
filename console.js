import { argv } from 'node:process'
import { db, getPasswordHash } from './config.js'

/*Launching the Node.js process as:
node process-args.js one two=three four 

Would generate the output:
0: /usr/local/bin/node
1: /Users/mjr/work/node/process-args.js
2: one
3: two=three
4: four */

try {
    if (argv[2]) {
        const operation = argv[2].toLowerCase()
        // login, password, wallet
        if (operation == 'add') {
            if (argv.length != 6 ) {
                console.error('Error: аdd user command "add <login> <password> <wallet>"')
                process.exit()
            }
            const arData = [argv[3].toLowerCase(), getPasswordHash(argv[4]), argv[5]]
            const r = await new Promise((resolve, reject) => {
                db.run("INSERT INTO users(login, password, wallet) VALUES (?,?,?)", arData,
                    function(err)  {
                        if(err) reject(err.message)
                        else    resolve(true)
                })
            })
            if (r) {
                console.log('Success')
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