function db_submit() {
  location.search = `?db=${document.getElementById("db-sel").value}`;
}

function table_submit() {
  location.search = `?db=${document.getElementById("db-sel").value}&table=${
    document.getElementById("table-sel").value
  }`;
}

function record_edit(id) {
  location.search = `?db=${document.getElementById("db-sel").value}&table=${
    document.getElementById("table-sel").value
  }&edit=${id}`;
}

function record_delete(id) {
  if (confirm(`Are you sure you would like to delete Record ID "${id}"?`)) {
    location.search = `?db=${document.getElementById("db-sel").value}&table=${
      document.getElementById("table-sel").value
    }&delete=${id}`;
  }
}

function record_create() {
  location.search = `?db=${document.getElementById("db-sel").value}&table=${
    document.getElementById("table-sel").value
  }&create=true`;
}

function sort_by_column(column) {
  if (location.search.includes(`sortBy=${column}&reversed=false`)) {
    location.search = `?db=${document.getElementById("db-sel").value}&table=${
      document.getElementById("table-sel").value
    }&sortBy=${column}&reversed=true`;
  } else {
    location.search = `?db=${document.getElementById("db-sel").value}&table=${
      document.getElementById("table-sel").value
    }&sortBy=${column}&reversed=false`;
  }
}