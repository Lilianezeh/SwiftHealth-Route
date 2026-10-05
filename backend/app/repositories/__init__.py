"""Repositories: the only layer that reads from or writes to the database.

One file per table group, e.g. listing_repository.py, report_repository.py. Services call
repositories; routes never query the database directly.
"""
