function db_submit() {
  location.search = `?db=${document.getElementById("db-sel").value}`;
}

function table_submit() {
  location.search = `?db=${document.getElementById("db-sel").value}&table=${
    document.getElementById("table-sel").value
  }`;
}
