import { logger, connectDB } from './functions.js'
import express from 'express'
const app = express()

try {
    app.get('/', (req, res) => {
        res.send('Qubic Power Proxy User')
    })

    app.get("/json/user/:user", (req, res) => {
        let user =  req.params.user
        const db = connectDB()
        if (user) {
            user = user.trim().toLowerCase()
            if (user) {
                let stats = {dateUpdate: '', workers: []}
                /*db.each(
                    `SELECT id, worker_id, user_id, last_active, date_time, its, sol, is_active FROM workers_statistics
                    WHERE date_time = (SELECT date_time FROM workers_statistics ORDER BY id DESC LIMIT 1)
                    and worker LIKE '${user}.%'
                    `, (err, row) => {
                        if (err) {
                            logger.error(err, 'Error sql on web-page /json/user/:user')
                        } else {
                            stats.workers.push({worker: row.worker, its: row.its, sol: row.sol, lastActive: row.last_active, isActive: row.is_active })
                        }
                    }, (err, count) => {
                        res.json(stats)
                    }
                )*/
            }
        }
        db.close()
    })

    app.get("/json/total", (req, res) => {
        res.json({total: ''})
    })
} catch (err) {
    logger.error(err);
}

app.listen(3000)