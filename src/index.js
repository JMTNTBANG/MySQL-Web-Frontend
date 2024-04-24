const mysql = require("mysql");
const url = require("url");
const config = require("./config.json");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");
const https = require("https");

const privateKey = fs.readFileSync('/etc/letsencrypt/live/db.jmtntbang.com/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/db.jmtntbang.com/cert.pem', 'utf8');
const ca = fs.readFileSync('/etc/letsencrypt/live/db.jmtntbang.com/chain.pem', 'utf8');

const credentials = {
	key: privateKey,
	cert: certificate,
	ca: ca
};

const database = mysql.createConnection({
  host: config.server.ip,
  port: config.server.port,
  user: config.auth.username,
  password: config.auth.password,
});

database.connect(function (err) {
  if (err) throw err;
});

function gen_webpage(req, page) {
  const urlbar = url.parse(req.url, true);
  function get_db_data(callback) {
    database.query("SHOW SCHEMAS", function (err, result, fields) {
      let schemas = "";
      if (err) {
        page.send(`${err}`);
        page.end();
        return;
      }
      schemas +=
        '<form onsubmit="db_submit(); return false;"><label for="db-sel">Database:</label> <select id="db-sel">';
      for (schema of result) {
        schemas += "<option";
        if (schema.Database == urlbar.query.db) schemas += " selected";
        schemas += ` value="${schema.Database}">${schema.Database}</option>`;
      }
      schemas += '</select> <input type="submit" value="Submit"></form>';
      database.query(
        `SHOW TABLES FROM ${urlbar.query.db}`,
        function (err, result, fields) {
          let tables = "";
          if (urlbar.query.db) {
            if (err) {
              page.send(`${err}`);
              page.end();
              return;
            }
            tables +=
              '<form onsubmit="table_submit(); return false;"><label for="tabel-sel">Tables:</label> <select id="table-sel">';
            for (table of result) {
              tables += `<option`;
              if (table[`Tables_in_${urlbar.query.db}`] == urlbar.query.table)
                tables += " selected";
              tables += `>${table[`Tables_in_${urlbar.query.db}`]}</option>`;
            }
            tables += '</select> <input type="submit" value="Submit"></form>';
          }
          database.query(
            `SELECT * FROM ${urlbar.query.db}.${urlbar.query.table}`,
            function (err, result, fields) {
              let final = "";
              if (urlbar.query.db && urlbar.query.table) {
                if (err) {
                  page.send(`${err}`);
                  page.end();
                  return;
                }
                final += '<table style="width:100%;"><tr>';
                for (column of fields) {
                  final += `<th>${column.name}</th>`;
                }
                final += `</tr>`;
                for (row of result) {
                  final += `<tr>`;
                  for (value in row) {
                    final += `<td>${row[value]}</td>`;
                  }
                  final += `</tr>`;
                }
                final += `</table>`;
              }
              callback({ schemas: schemas, tables: tables, final: final });
            }
          );
        }
      );
    });
  }
  function gen_skeleton(data) {
    let payload = "";
    const client_script = fs.readFileSync("src/client.js").toString();
    const client_styles = fs.readFileSync("src/client.css").toString();
    let header = "<h1>Please Select a Database and Table:</h1>";
    let title = "Database Home"
    if (urlbar.search && urlbar.query.db && urlbar.query.table) {
      header = `<h1>Contents of ${urlbar.query.table} in ${urlbar.query.db}:</h1>`;
      title = `Contents of ${urlbar.query.table} in ${urlbar.query.db}`
    }
    payload += `<title>${title}</title><script>${client_script}</script><style>${client_styles}</style>${header}${data.schemas}${data.tables}${data.final}`;
    page.send(payload);
    page.end();
  }
  get_db_data(gen_skeleton);
}

const app = express();
app.use(session({ secret: "secret", resave: true, saveUninitialized: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "static")));
app.get("/", function (request, response) {
  if (request.session.loggedin) {
    gen_webpage(request, response);
  } else {
    response.sendFile(path.join(__dirname + "/login.html"));
  }
});
app.post("/auth", function (request, response) {
  let username = request.body.username;
  let password = request.body.password;
  if (username && password) {
    database.query(
      "SELECT * FROM auth.accounts WHERE username = ? AND password = ?",
      [username, password],
      function (error, results, fields) {
        if (error) throw error;
        if (results.length > 0) {
          request.session.loggedin = true;
          request.session.username = username;
        }
        response.redirect("/");
        response.end();
      }
    );
  }
});

const httpServer = http.createServer(app);
const httpsServer = https.createServer(credentials, app);

httpServer.listen(80, () => {
	console.log('HTTP Server running on port 80');
});

httpsServer.listen(443, () => {
	console.log('HTTPS Server running on port 443');
});