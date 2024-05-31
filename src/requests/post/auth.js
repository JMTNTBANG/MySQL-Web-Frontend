const url = require("url");
const mysql = require("mysql");
const config = require("../../config.json");
const static_tables = require("../../staticTables.json")

module.exports = {
  init: (prefix, website) => {
    if (!prefix) {
      prefix = "/"
    }
    // Database
    const database = mysql.createConnection({
      host: config.server.ip,
      port: config.server.port,
      user: config.auth.username,
      password: config.auth.password,
    });
    // .connect((err) => {
    //   if (err) throw err;
    //   console.log(
    //     `Connected to MySQL Database at '${config.auth.username}@${config.server.ip}:${config.server.port}'`
    //   );
    // });
    function validate_auth_schema(callback) {
      database.query("SHOW SCHEMAS", (err, result, fields) => {
        if (err) throw err;
        let auth = false;
        for (schema of result) {
          if (schema.Database == "auth") {
            auth = true;
          }
        }
        callback(auth);
      });
    }

    function validate_mysql_obj(
      callback,
      data = { schema: "", table: "", columns: "" }
    ) {
      function create(skip_db = false) {
        function create_table() {
          database.query(
            `CREATE TABLE ${data.schema}.${data.table} (${data.columns});`,
            (err, result) => {
              if (err) throw err;
              callback();
            }
          );
        }
        if (!skip_db) {
          database.query(
            `CREATE SCHEMA ${data.schema};`,
            (err, result) => {
              if (err) throw err;
              create_table();
            }
          );
        } else create_table();
      }
      database.query("SHOW SCHEMAS", (err, result, fields) => {
        if (err) throw err;
        let schema_exists = false;
        for (schemas of result) {
          if (schemas.Database == data.schema) {
            schema_exists = true;
          }
        }
        if (!schema_exists) create();
        else
          database.query(
            `SHOW TABLES FROM ${data.schema}`,
            (err, result, fields) => {
              if (err) throw err;
              let table_exists = false;
              for (tables of result) {
                if (tables[`Tables_in_${data.schema}`] == data.table) {
                  table_exists = true;
                }
              }
              if (!table_exists) create(true);
              else callback();
              return;
            }
          );
      });
    }
    website.post(`${prefix}auth`, (req, page) => {
      validate_mysql_obj(() => {
        let username = req.body.username;
        let password = req.body.password;
        let previous_query = url.parse(req.rawHeaders[33], true).search;
        if (previous_query == null) {
          previous_query = "";
        } else {
          previous_query.slice(0, 1)
        }
        if (username && password) {
          database.query(
            "SELECT * FROM auth.accounts WHERE username = ? AND password = ?",
            [username, password],
            (err, results, fields) => {
              if (err) {
                page.send(
                  `<script>alert("${err}"); history.back();</script>`
                );
                page.end();
                return;
              }
              if (results.length > 0) {
                req.session.dbloggedin = true;
                req.session.dbusername = username;
                req.session.dbuserId = results[0].ID;
                database.query(
                  `INSERT INTO history.logins (\`accountID\`, \`username\`, \`ip\`, \`type\`) VALUES ('${results[0].ID}', '${username}', '${req.ip}', 'LOGIN');`,
                  (err, result) => {
                    if (err) throw err;
                  }
                );
              }
              page.redirect(`${prefix}${previous_query}`);
              page.end();
            }
          );
        }
      }, static_tables.history.logins);
    });
  },
};
