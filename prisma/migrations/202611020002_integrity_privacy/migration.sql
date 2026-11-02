-- Privacy erasure is an explicit, audited exception to content immutability.
-- Ordinary edits and restores still create new revisions.
CREATE OR REPLACE FUNCTION immutable_personas_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE redaction_id text;
BEGIN
 redaction_id := current_setting('personas.redaction_id',true);
 IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('PersonaRevision','PublishedSnapshot') AND redaction_id IS NOT NULL AND EXISTS (
   SELECT 1 FROM "AuditEvent" WHERE id=redaction_id AND action='privacy.redacted' AND "workspaceId"=to_jsonb(NEW)->>'workspaceId' AND length(detail->>'reason')>=10
 ) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Immutable record: create a new revision instead';
END; $$;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION immutable_personas_record();
CREATE FUNCTION check_project_member() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM "Project" p JOIN "Membership" m ON m."workspaceId"=p."workspaceId" WHERE p.id=NEW."projectId" AND m."userId"=NEW."userId") THEN RAISE EXCEPTION 'Project member must belong to its workspace'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER project_member_scope BEFORE INSERT OR UPDATE ON "ProjectMember" FOR EACH ROW EXECUTE FUNCTION check_project_member();
CREATE FUNCTION check_comment_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM "PersonaRevision" r WHERE r.id=NEW."revisionId" AND r."personaId"=NEW."personaId") THEN RAISE EXCEPTION 'Comment revision scope mismatch'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER comment_revision_scope BEFORE INSERT OR UPDATE ON "Comment" FOR EACH ROW EXECUTE FUNCTION check_comment_revision();
CREATE FUNCTION check_observation_anchor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM "ResearchSource" s WHERE s.id=NEW."sourceId" AND substring(s.text FROM NEW.start+1 FOR NEW."end"-NEW.start)=NEW.quote AND (NEW.classification<>'finding' OR s.classification='finding')) THEN RAISE EXCEPTION 'Observation passage does not match its source'; END IF; RETURN NEW;
END; $$;
CREATE TRIGGER observation_exact_anchor BEFORE INSERT ON "Observation" FOR EACH ROW EXECUTE FUNCTION check_observation_anchor();
