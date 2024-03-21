import { createHash } from 'node:crypto'
import sqlite3 from 'sqlite3'
import pino from 'pino'

export const logger = pino({
    level: "debug",
})
export function getPasswordHash(password) {
    return createHash('sha256').update('QubicPowerProxy' + password).digest('hex')
}
export function connectDB () {
    return new sqlite3.Database('db.sqlite')
}
/**
 * 
 * @returns int Timestamp in seconds of last Wednesday. Example:  Wed, 13 Mar 2024 12:00:00 GMT = 1710331200
 */
export function getTimestampOfLastWednesday () {
    const date = new Date
    date.setDate(date.getUTCDate() - date.getUTCDay() - 3) // last wednesday
    date.setUTCHours(12)
    date.setUTCMinutes(0)
    date.setUTCSeconds(0)
    return Math.floor(date.getTime()/1000)
}

export async function dbCreateUser(db, login, password, wallet = '') {
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO users(login, password, wallet) VALUES (?,?,?)", [login, password, wallet],
            function(err)  {
                if(err) reject(err.message)
                else    resolve(true)
        })
    })
}