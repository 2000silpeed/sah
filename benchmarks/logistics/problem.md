# Multi-carrier shipment control

Our dispatch team arranges high-value medical shipments that may travel through several
carriers and handoff depots. A shipment has pickup and delivery commitments, package details,
handling restrictions, and a planned sequence of legs. Dispatchers may reroute it when weather,
capacity, or customs problems occur.

Carriers report pickup, arrival, departure, delay, custody handoff, and delivery in different
formats. Reports are duplicated, delayed, and sometimes arrive out of order. Some carriers
offer web calls, some send messages, and two still upload files. Customers need a current view
and an explanation of where a delay came from. Dispatchers need the original carrier report
when a normalized status is disputed.

Temperature-controlled packages must never be assigned to an unsuitable leg. Custody must
always identify an accountable party, and delivery requires acceptable proof. A missed
temperature report should alert operations without erasing otherwise valid tracking history.

We handle 500,000 active shipments and 20 million reports a day. Customer tracking may be five
minutes behind, but dispatch alerts should normally arrive within 30 seconds. We have not
decided how an out-of-order correction changes a customer notification or whether a reroute
invalidates already accepted future handoffs.
