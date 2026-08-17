# Equipment register

Our operations team needs a small internal web tool to replace a shared spreadsheet. Three
authorized coordinators should be able to add, edit, view, and archive equipment. Each item
has an asset tag, name, category, assigned person's email, purchase date, and status.

The asset tag must be unique. Archived items should not appear in the normal list, but staff
need to find them when explicitly requested. People should be able to search by asset tag or
name, filter by category and status, and download the current filtered list as CSV.

We expect fewer than 20,000 items and ordinary weekday use. A change should show who made it
and when, and that history should be retained for one year. Validation errors must be useful
to office staff. Availability outside working hours is not important.

We have not decided whether archived items can be restored, what happens when two people edit
the same item, or whether coordinators can maintain the category list themselves. We want a
solution the next developer can understand without a large platform to operate.
