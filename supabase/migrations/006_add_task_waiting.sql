-- Add the "waiting" task status used by the visual task board (To Do /
-- In Progress / Waiting / Completed). Supported on Postgres 13+.
alter type task_status add value if not exists 'waiting';