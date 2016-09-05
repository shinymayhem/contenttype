## 2.0.0

* Added tests for RFC spec

---

## 2.1.0

* Allow wildcards in params (e.g. `text/html;level=2.*`)
---

## 3.0.0

* Wildcards in params equate during comparisons (e.g. `text/html;level=2.*` = `text/html;level=2.9`)
    * specificity still works correctly (e.g. `level=2.9` is more specific than `2.*`, and will be prioritized during negotiation
