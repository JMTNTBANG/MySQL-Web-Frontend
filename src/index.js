// Internal Modules
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const url = require("url");

// External Modules
const express = require("express");
const mysql = require("mysql");
const session = require("express-session");

// Local Files
const config = require("./config.json");
const static_tables = require("./staticTables.json")

// Init function for when running as module
function init() {
  const database = mysql.createConnection({
    host: config.server.ip,
    port: config.server.port,
    user: config.auth.username,
    password: config.auth.password,
  });
  function validate_mysql_obj(
    callback,
    data = { schema: "", table: "", columns: "" }
  ) {
    function create(skip_db = false) {
      function create_table() {
        database.query(
          `CREATE TABLE ${data.schema}.${data.table} (${data.columns});`,
          function (err, result) {
            if (err) throw err;
            callback();
          }
        );
      }
      if (!skip_db) {
        database.query(
          `CREATE SCHEMA ${data.schema};`,
          function (err, result) {
            if (err) throw err;
            create_table();
          }
        );
      } else create_table();
    }
    database.query("SHOW SCHEMAS", function (err, result, fields) {
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
  // Web Server Initialization
  const website = express();
  website.use(
    session({ secret: "secret", resave: true, saveUninitialized: true })
  );
  website.use(express.json());
  website.use(express.urlencoded({ extended: true }));
  website.use(express.static(path.join(__dirname, "static")));

  for (const getRequest of fs.readdirSync(`${__dirname}/requests/get/`)) {
    let request = require(`${__dirname}/requests/get/${getRequest}`);
    request.init(website);
  }
  for (const postRequest of fs.readdirSync(`${__dirname}/requests/post/`)) {
    let request = require(`${__dirname}/requests/post/${postRequest}`);
    request.init(website);
  }

  // Open Ports
  validate_mysql_obj(() => {
    let ports = "";
    try {
      https
        .createServer(
          {
            key: fs.readFileSync(`${config.ssl}/privkey.pem`, "utf8"),
            cert: fs.readFileSync(`${config.ssl}/cert.pem`, "utf8"),
            ca: fs.readFileSync(`${config.ssl}/chain.pem`, "utf8"),
          },
          website
        )
        .listen(443, () => {
          console.log("HTTPS Server running on port 443");
        });
      ports += "443, ";
    } catch {
      console.log("Caution: Connections will not be secured");
    }
    const httpServer = http.createServer(website);
    httpServer.listen(8080, () => {
      console.log("HTTP Server running on port 8080");
    });
    ports += "8080";
    database.query(
      `INSERT INTO history.startupLog (\`ports\`) VALUES ('${ports}');`,
      function (err, result) {
        if (err) throw err;
      }
    );
  }, static_tables.history.startupLog);
}

module.exports = { init: init() };
