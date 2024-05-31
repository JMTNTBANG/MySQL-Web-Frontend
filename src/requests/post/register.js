const mysql = require("mysql");
const config = require("../../config.json");

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
    function validate_auth_schema(callback) {
      database.query("SHOW SCHEMAS", function (err, result, fields) {
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
    website.post(`${prefix}register`, (req, page) => {
      validate_auth_schema((valid) => {
        if (valid) return;
        let username = req.body.username;
        let password = req.body.password;
        database.query("CREATE SCHEMA auth;", (err, result) => {
          if (err) {
            page.send(`<script>alert("${err}"); history.back();</script>`);
            page.end();
            return;
          }
          database.query(
            "CREATE TABLE auth.accounts (`ID` INT NOT NULL AUTO_INCREMENT, `username` VARCHAR(50) NOT NULL, `password` VARCHAR(255) NOT NULL, `admin` TINYINT NOT NULL  DEFAULT 0, `createdDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`ID`));",
            function (err, result) {
              if (err) {
                page.send(
                  `<script>alert("${err}"); history.back();</script>`
                );
                page.end();
                return;
              }
              database.query(
                `INSERT INTO auth.accounts (\`username\`, \`password\`, \`admin\`) VALUES ('${username}', '${password}', 1);`,
                function (err, result) {
                  if (err) {
                    page.send(
                      `<script>alert("${err}"); history.back();</script>`
                    );
                    page.end();
                    return;
                  }
                  page.redirect(`${prefix}`);
                }
              );
            }
          );
        });
      });
    });
  },
};
