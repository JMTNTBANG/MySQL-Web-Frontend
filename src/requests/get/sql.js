const mysql = require("mysql");
const config = require("../../config.json");
const static_tables = require("../../staticTables.json")

module.exports = {
  init: (prefix, website) => {
    if (!prefix) {
      prefix = "/";
    }
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
    function permissionsFor(user, schema, table = undefined) {
      for (permission of user.permissions) {
        if (permission.schema == schema) {
          if (!table || permission.table == table || permission.table == "*") {
            let hasAll = 0;
            if (
              permission.canView == 1 &&
              permission.canCreate == 1 &&
              permission.canEdit == 1 &&
              permission.canDelete == 1
            )
              hasAll = 1;
            return {
              canView: permission.canView,
              canCreate: permission.canCreate,
              canEdit: permission.canEdit,
              canDelete: permission.canDelete,
              hasAll: hasAll,
            };
          } else continue;
        } else continue;
      }
      if (user.admin == 1)
        return {
          canView: 1,
          canCreate: 1,
          canEdit: 1,
          canDelete: 1,
          hasAll: 1,
        };
      return null;
    }

    website.get(`${prefix}sql`, (req, res) => {
      validate_mysql_obj(() => {
        if (req.session.dbloggedin) {
          database.query(
            `SELECT * FROM auth.permissions WHERE userId = ${req.session.dbuserId}`,
            (err, permissions, x) => {
              if (err) throw err;
              database.query(
                `SELECT * FROM auth.accounts WHERE ID = ${req.session.dbuserId}`,
                (err, account, x) => {
                  if (err) throw err;
                  account = account[0];
                  account.permissions = permissions;
                  account.permissions = permissionsFor(account, "[SQL]")
                  if (account.permissions != null && account.permissions.hasAll == 1) {
                    res.sendFile(`${__dirname.slice(0, -13)}/sql.html`);
                  } else {
                    res.send(
                      `<script>alert("Access Denied"); history.back();</script>`
                    );
                    res.end();
                  }
                }
              );
            }
          );
        }
      }, static_tables.auth.permissions);
    });
  },
};
