//Load libraries
const express = require('express')
const handlebars = require('express-handlebars')
const mysql = require('mysql2/promise')
const fetch = require('node-fetch')
const withQuery = require('with-query').default



//create PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

//create an instance of express
const app = express()

//configure handlebars
app.engine('hbs', handlebars({
    defaultLayout: 'default.hbs'
}))
app.set('view engine', 'hbs')

//create SQL
const SQL_GET_TITLE= 'select book_id, title from book2018 where title like ? limit ? offset ?'

//create the database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost', 
    port: parseInt(process.env.DB_PORT) || 3306, 
    database: process.env.DB_NAME || 'goodreads',
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD,    
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 4,
    timezone: '+08:00'
});

const runApp = async (app, pool) => {
    try {
        const conn = await pool.getConnection()

        console.info('Pinging database')
        await conn.ping

        conn.release()

        app.listen(PORT, () => {
            console.info(`Application start on port ${PORT} at ${new Date()}`)
        })
    } catch(e) {
        console.error('cannot ping databse', e)
    }
}



app.get('/', (req, res) => {

    res.status(200)
    res.type('text/html')
    res.render('index')
})

app.get('/title', async (req, res) => {
    const letter = req.query['letter']
    const OFFSET = parseInt(req.query['offset']) || 0
    const LIMIT = 10

    const conn = await pool.getConnection()

    try{
        const result = await conn.query(SQL_GET_TITLE, [`${letter}%`,LIMIT, OFFSET])
         
        console.info('result: ', result)

        res.status(200)
        res.type('text/html')
        res.render('title',{
            app: result[0],
            letter: letter,
            prevOffset: Math.max(0, OFFSET - LIMIT),
            nextOffset: OFFSET + LIMIT
        })
    } catch(e) {
        res.status(500)
        res.type('text/html')
        res.send(JSON.stringify(e))

    }finally{
        conn.release()
    }

})
 


runApp(app,pool)


