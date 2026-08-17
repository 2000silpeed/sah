# Shared incident map

Emergency teams use a shared map during large events. Up to 10,000 people may view one map and
500 may edit it at the same time. Editors add, move, rename, and delete markers and regions;
they also attach short notes. Everyone should see local feedback within 50 ms and other online
edits within 300 ms in normal conditions.

Users can briefly lose connectivity, continue editing for up to ten minutes, and reconnect.
Two people may move or rename the same marker, one may delete a region while another edits its
note, and an administrator may lock an area against further changes. All connected users must
eventually agree on durable map content. Cursor positions and current selections may be lost
and should not clutter long-term history.

We need a reviewable history of durable edits and the ability to restore the map to a known
point after an operator mistake. A user must not edit incidents they cannot access. One region's
heavy activity should not freeze unrelated maps.

We have not agreed which concurrent intent should win for each edit type, whether deleted
content can be resurrected by an offline edit, or how much history must remain immediately
available during an incident.
