import { install, users } from './config.js'
import { connectDB, getTimestampOfLastWednesday, getPasswordHash } from './functions.js'


const db = connectDB()
db.serialize(() => {
    db.run(`CREATE TABLE config (
        name VARCHAR NOT NULL,
        value TEXT
    );`)
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login VARCHAR(25) NOT NULL UNIQUE,
        password VARCHAR(64) NOT NULL,
        wallet VARCHAR(60) NOT NULL
    );`)
    db.run(` CREATE TABLE workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(25) NOT NULL,
        user_id INTEGER NOT NULL,
        UNIQUE(name, user_id),
        FOREIGN KEY (user_id)  REFERENCES users (id)
    );`)
    db.run(`CREATE TABLE epoch_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        epoch INTEGER,
        datetime INTEGER NOT NULL,
        user_id INTEGER,
        sol INTEGER,
        its REAL,
        share REAL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );`)
    // previous epoch is 0
    db.run(
        `INSERT INTO epoch_statistics(epoch, datetime, user_id, sol, its, share)  VALUES (?,?,1,0,0,0);`,
        [install.currentEpoch-1, getTimestampOfLastWednesday() - 7*24*60*60]
    )
    db.run(`CREATE TABLE workers_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id VARCHAR(25) NOT NULL,
        worker_id VARCHAR(25) NOT NULL,
        last_active VARCHAR(25),
        its INTEGER NOT NULL,
        sol INTEGER NOT NULL,
        is_active BOOLEAN NOT NULL,
        datetime INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (worker_id) REFERENCES workers (id)
    );`)

    const stmt = db.prepare("INSERT INTO users(login, password, wallet) VALUES (?,?,?)")
    for(let user of users) {
        stmt.run(user[0], getPasswordHash(user[1]), user[2])
    }
    stmt.finalize()
})

db.close()