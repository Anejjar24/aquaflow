"""
pytest configuration — Jest-style file-level reporting.
Shows one PASSED/FAILED line per test file instead of individual test names.
"""

import os

# Fix PySpark on Windows — point to hadoop stub if winutils not installed
_hadoop_home = os.environ.get("HADOOP_HOME", "")
if not _hadoop_home:
    os.environ.setdefault("HADOOP_HOME", "C:\\hadoop")
    os.environ.setdefault("PYSPARK_SUBMIT_ARGS",
        "--conf spark.hadoop.fs.defaultFS=file:/// "
        "--conf spark.driver.host=localhost "
        "pyspark-shell")

_file_status = {}


def pytest_runtest_logreport(report):
    """Track pass/fail result per test file."""
    if report.when == "call":
        file_path = report.nodeid.split("::")[0]
        if file_path not in _file_status:
            _file_status[file_path] = True
        if not report.passed:
            _file_status[file_path] = False


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    """Print file-level PASSED / FAILED lines (Jest-style)."""
    if not _file_status:
        return
    terminalreporter.write_sep(" ", "")
    for file_path, passed in _file_status.items():
        if passed:
            terminalreporter.write_line(
                f" PASSED  {file_path}", green=True, bold=True
            )
        else:
            terminalreporter.write_line(
                f" FAILED  {file_path}", red=True, bold=True
            )
