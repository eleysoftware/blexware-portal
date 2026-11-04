-- BLEXware — add a UAT (user acceptance testing) lane after Testing.
ALTER TYPE public.milestone_lane add value if not exists 'uat' after 'testing';

-- THIS HAS BEEN ADDED TO 010_project_milestones.sql. This is no longer needed. --
