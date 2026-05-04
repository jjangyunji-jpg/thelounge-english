import { todayKSTString } from "@/lib/utils";

type StudentMeetRecord = {
  meet_link: string | null;
  english_name?: string | null;
  instructor_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  transfer_status?: string | null;
  transfer_date?: string | null;
  created_at?: string | null;
};

const toKSTDateString = (input?: string | Date | null) => {
  if (!input) return todayKSTString();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(input));
};

const isEffectiveOn = (record: StudentMeetRecord, date: string) => {
  const start = record.start_date || record.transfer_date || "0000-01-01";
  const end = record.end_date || "9999-12-31";
  return record.status !== "inactive" && start <= date && date < end;
};

const sortLatestFirst = (a: StudentMeetRecord, b: StudentMeetRecord) =>
  (b.start_date || b.transfer_date || "").localeCompare(a.start_date || a.transfer_date || "") ||
  (b.created_at || "").localeCompare(a.created_at || "");

export async function loadEffectiveStudentMeetInfo(
  supabaseClient: any,
  studentName: string,
  scheduledAt?: string | Date | null,
  fallbackMeetLink = "",
) {
  const { data } = await supabaseClient
    .from("instructor_students")
    .select("meet_link, english_name, instructor_name, start_date, end_date, status, transfer_status, transfer_date, created_at")
    .eq("student_name", studentName)
    .order("start_date", { ascending: false });

  const records = ((data ?? []) as StudentMeetRecord[]).sort(sortLatestFirst);
  const sessionDate = toKSTDateString(scheduledAt);
  const effective = records.find((record) => isEffectiveOn(record, sessionDate));
  const latestActive = records.find((record) => record.status !== "inactive");
  const selected = effective || latestActive || records[0];

  return {
    meetLink: selected?.meet_link || fallbackMeetLink || "",
    englishName: selected?.english_name || "",
    instructorName: selected?.instructor_name || "",
  };
}