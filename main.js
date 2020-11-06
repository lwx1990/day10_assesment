//Load libraries
const express = require('express')
const handlebars = require('express-handlebars')
const mysql = require('mysql2/promise')
const fetch = require('node-fetch')
const withQuery = require('with-query').default
const morgan = require('morgan')

//create PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

const API_KEY = process.env.API_KEY || ""
const REVIEW_URL = "https://api.nytimes.com/svc/books/v3/reviews.json"

//create an instance of express
const app = express()

//configure handlebars
app.engine('hbs', handlebars({
    defaultLayout: 'default.hbs'
}))
app.set('view engine', 'hbs')

//create SQL
const SQL_GET_TITLE= 'select book_id, title from book2018 where title like ? limit ? offset ?'
const SQL_GET_BOOK_ID = 'select * from book2018 where book_id = ?'
const SQL_COUNT = 'select count(*)from book2018 where title like ?'

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

app.use(morgan('combined'))

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
            nextOffset: OFFSET + LIMIT,
            
        })
    } catch(e) {
        res.status(500)
        res.type('text/html')
        res.send(JSON.stringify(e))

    }finally{
        conn.release()
    }

})

app.get('/display/:book_id', async (req, res) => {
    const book_id = req.params['book_id']

    const conn = await pool.getConnection()

    

    try {
        const results = await conn.query(SQL_GET_BOOK_ID, [ book_id ])
        const recs = results[0]
        console.info('recs', recs)
        let genre = recs[0]["genres"]
        let genre2 = genre.split('|').join()
        recs[0].genres = genre2
        console.info('genre2' , genre2)
        let author = recs[0]["authors"]
        let author2 = author.split('|').join()
        recs[0].authors = author2
        if (recs.length <= 0) {
            //404!
            res.status(404)
            res.type('text/html')
            res.send(`Not found: ${book_id}`)
            return
        }

        res.status(200)
        res.type('text/html')
        res.format({
            'text/html': () => {
                res.type('text/html')
                res.render('display', { display: recs[0] 
                    
                
                })
            },
            'application/json': () => {
                res.type('application/json')
                res.json({
                    bookId: recs[0].book_id,
                    title:  recs[0].title,
                    authors: recs[0].authors,
                    summary: recs[0].description,
                    pages: recs[0].pages,
                    rating: recs[0].rating,
                    ratingCount: recs[0].rating_count,
                    genre: recs[0].genres

                })
            },
            'default': () => {
                res.type('text/plain')
                res.send(JSON.stringify(recs[0]))
            }
        })
        // res.render('display', {
        //     display: recs[0]
        // })

    } catch(e) {
        res.status(500)
        res.type('text/html')
        res.send(JSON.stringify(e))
    } finally {
        conn.release()
    }
})

app.get('/display/reviews/:title', async (req, resp) => {
    const title = req.params.title
    
    console.info('reviews: ', title)


    //construct the url with the query parameter
    const url = withQuery(
        REVIEW_URL, {
            'api-key': API_KEY,
            title: title
        }
    )
   
    const result = await fetch(url)
    const review = await result.json()

    let book_review = review["results"][0]
     
    console.info('Reviews: ', review)  
    
    resp.status(200)
    resp.type('text/html')
    
    resp.render('review', {
        
        book_review,
        copyright: review.copyright,
        hasResult: review["results"].length > 0

    
        
    })

    
})




runApp(app,pool)


