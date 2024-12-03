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
    // .connect((err) => {
    //   if (err) throw err;
    //   console.log(
    //     `Connected to MySQL Database at '${config.auth.username}@${config.server.ip}:${config.server.port}'`
    //   );
    // });
    
    website.post(`${prefix}sqlquery`, (req, page) => {
        let query = req.body.sqlquery;
        if (query) {
          database.query(
            query,
            (err, results, fields) => {
              if (err) {
                page.send(
                  `<script>alert("${err}"); history.back();</script>`
                );
                page.end();
                return;
              }
              page.send(`<code><pre>${JSON.stringify(results, undefined, 2)}</pre></code>`)
              page.end();
            }
          );
        }
    });
  },
};
