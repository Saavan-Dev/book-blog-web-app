import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import env from "dotenv";
import fetch from 'node-fetch'; // Import node-fetch at the top of your file

const app = new express();
const port = 3000;
env.config();
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL ,
  // user: process.env.PG_USER,
  // host: process.env.PG_HOST,
  // database: process.env.PG_DATABASE,
  // password: process.env.PG_PASSWORD,
  // port: process.env.PG_PORT
})

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function getAllBookBlogRecords() {
  const client = await pool.connect();
  try {
    let bookBlogData = [];
    let bookBlogPromises = [];
    let bookBlogRecords = await client.query(
      "SELECT * FROM public.books ORDER BY id ASC"
    );

    bookBlogRecords.rows.forEach((row) => {
      let promise = fetch(
        `https://covers.openlibrary.org/b/ISBN/${row.isbn_number}-M.jpg`
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error("Book cover not found");
          }
          return response.url;
        })
        .catch((error) => {
          console.error("Error fetching book cover:", error.message);
          return "/images/NOT_AVAILABLE.png"; // Return "No Image Available" if cover image fetching fails
        });
      bookBlogPromises.push(promise);
    });

    // Wait for all promises to resolve
    let coverImageUrls = await Promise.all(bookBlogPromises);

    // Assign cover image URLs to corresponding rows
    bookBlogRecords.rows.forEach((row, index) => {
      row.cover_image = coverImageUrls[index];
      bookBlogData.push(row);
    });

    return bookBlogData;
  } catch (error) {
    console.error("Error executing query:", error);
    throw error; // Propagate the error to the caller
  } finally {
    client.release();
  }
}
// async function getAllBookBlogRecords() {
//   const client = await pool.connect();
//   try {
//      let bookBlogData = [];
//      let bookBlogPromises = [];
//      let bookBlogRecords = await client.query(
//        "SELECT * FROM public.books ORDER BY id ASC"
//      );
 
//      bookBlogRecords.rows.forEach((row) => {
//        let promise = fetch(
//          `https://covers.openlibrary.org/b/ISBN/${row.isbn_number}-M.jpg`
//        )
//          .then((response) => {
//            if (!response.ok) {
//              throw new Error("Book cover not found");
//            }
//            return response.url;
//          })
//          .catch((error) => {
//            console.error("Error fetching book cover:", error.message);
//            return "/images/NOT_AVAILABLE.png"; // Return "No Image Available" if cover image fetching fails
//          });
//        bookBlogPromises.push(promise);
//      });
 
//      // Wait for all promises to resolve
//      let coverImageUrls = await Promise.all(bookBlogPromises);
 
//      // Assign cover image URLs to corresponding rows
//      bookBlogRecords.rows.forEach((row, index) => {
//        row.cover_image = coverImageUrls[index];
//        bookBlogData.push(row);
//      });
 
//      return bookBlogData;
//   } catch (error) {
//      console.error("Error executing query:", error);
//      throw error; // Propagate the error to the caller
//   } finally {
//      client.release();
//   }
//  }

app.get("/", async (req, res) => {
  const data = await getAllBookBlogRecords();
  res.render("index.ejs", {
    books: data,
  });
});

app.get("/contact",(req,res)=>{
  res.render("contact.ejs",{});
})

app.get("/add-new-post", (req, res) => {
  res.render("addNewPost.ejs", {});
});

app.post("/submit-post", async (req, res) => {
  const client = await pool.connect();
  const bookname = req.body.bookName;
  const booktitle = req.body.bookTitle;
  const bookdescription = req.body.bookDescription;
  const isbnnumber = req.body.isbnNumber;
  try {
    await client.query(
      "INSERT INTO public.books(book_name, book_title, book_description, isbn_number)VALUES ($1, $2, $3, $4);",
      [bookname, booktitle, bookdescription, isbnnumber]
    );
    res.redirect("/");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.get("/edit-post/:id", async (req, res) => {
  const client = await pool.connect();
  const id = req.params.id;
  try {
    let bookBlogRecords = await client.query(
      "SELECT * FROM public.books WHERE id=$1;",
      [id]
    );
    console.log("bookBlogRecords.rows[0] : ", bookBlogRecords.rows[0]);
    res.render("editPost.ejs", {
      book: bookBlogRecords.rows[0], // Pass the first row of the result (assuming there's only one row)
    });
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.post("/edit-post/:id", async (req, res) => {
  const client = await pool.connect();
  const id = req.params.id;
  const bookname = req.body.bookName;
  const booktitle = req.body.bookTitle;
  const bookdescription = req.body.bookDescription;
  const isbnnumber = req.body.isbnNumber;
  try {
    await client.query(
      "UPDATE public.books SET book_name=$2, book_title=$3, book_description=$4, isbn_number=$5 WHERE id=$1;",
      [id, bookname, booktitle, bookdescription, isbnnumber]
    );
    res.redirect("/");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.post("/delete-post/:id", async (req, res) => {
  const client = await pool.connect();
  const id = req.params.id;
  try {
    await client.query("DELETE FROM public.books WHERE  id=$1;", [id]);
    res.redirect("/");
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// const HTTP_SERVER_ERROR = 500;
// app.use(function(err, req, res, next) {
//  if (res.headersSent) {
//     return next(err);
//  }

//  return res.status(err.status || HTTP_SERVER_ERROR).render('500');
// });

app.listen(port, () => {
  console.log(`started listening on port 3000 url is localhost:${port}`);
});
