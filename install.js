import { getPasswordHash, users, logger, db } from './config.js'



db.serialize(() => {
    db.run(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            login VARCHAR(20) NOT NULL UNIQUE,
            password VARCHAR(64) NOT NULL,
            wallet VARCHAR(60) NOT NULL
            --number_workers INTEGER NOT NULL
        );
        CREATE TABLE workers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(20) NOT NULL,
            user_id INTEGER,
            FOREIGN KEY (user_id)  REFERENCES users (id)
        );
        CREATE TABLE epoch_statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            epoch INTEGER,
            user_id INTEGER,
            sol INTEGER,
            its REAL,
            FOREIGN KEY (user_id) REFERENCES users (id),
        );
        CREATE TABLE workers_statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            worker_id INTEGER NOT NULL,
            last_active VARCHAR(25),
            date_time INTEGER NOT NULL,
            its INTEGER NOT NULL,
            sol INTEGER NOT NULL,
            is_active BOOLEAN NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (worker_id) REFERENCES workers (id)
        );
    `)

    const stmt = db.prepare("INSERT INTO users(login, password, wallet) VALUES (?,?,?)")
    for(let user of users)
    {
        stmt.run(user[0], getPasswordHash(user[1]), user[2])
    }
    stmt.finalize()
});

db.close();