-- BLEXware — add a UAT (user acceptance testing) lane after Testing.
alter type public.milestone_lane add value if not exists 'uat' after 'testing';
