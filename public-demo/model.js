export const STAGES = ["Saved", "Applied", "Interviewing", "Offer", "Rejected"];
// Every screening value is fictional, just like the sample roles themselves.
const SAMPLE_FACETS = {
  "sample-engineering": {
    level: "Senior",
    employment: "Full-time",
    industry: "Software",
    region: "US-wide",
    travelPercent: 0,
    interviewSteps: 3,
  },
  "sample-design": {
    level: "Mid-level",
    employment: "Contract",
    industry: "Software",
    region: "Illinois",
    travelPercent: 0,
    interviewSteps: 4,
    travel: "Illustrative: two office days weekly; no business travel",
  },
  "sample-operations": {
    level: "Entry-level",
    employment: "Part-time",
    industry: "Healthcare",
    region: "Illinois",
    travelPercent: 10,
    interviewSteps: 2,
  },
  "sample-marketing": {
    level: "Mid-level",
    employment: "Contract",
    industry: "Media & entertainment",
    region: "US Central / Eastern",
    travelPercent: 10,
    interviewSteps: 2,
  },
  "sample-customer-success": {
    level: "Mid-level",
    employment: "Full-time",
    industry: "Consumer services",
    region: "US-wide",
    travelPercent: 25,
    interviewSteps: null,
  },
  "sample-accounting": {
    level: "Senior",
    employment: "Full-time",
    industry: "Healthcare",
    region: "Illinois",
    travelPercent: null,
    interviewSteps: 3,
    travel: "Illustrative: business travel not specified",
  },
};
export const SAMPLE_JOBS = [
  {
    id: "sample-engineering",
    company: "Aster Example",
    role: "Software Engineer",
    career: "Engineering",
    workplace: "Remote",
    location: "United States",
    min: 110000,
    max: 140000,
    resume: "Engineering sample",
    priority: true,
    stage: "Saved",
    favorite: true,
    nextAction: "Review the sample technical requirements",
    notes: "",
    duties:
      "Build web features, collaborate on code reviews, and maintain automated tests.",
    requirements: [
      "Web application experience",
      "Testing and version control",
      "Clear written communication",
    ],
    gap: "This sample does not assess any real candidate.",
    travel: "Illustrative: no routine travel",
  },
  {
    id: "sample-design",
    company: "Birch Example",
    role: "Product Designer",
    career: "Design",
    workplace: "Hybrid",
    location: "Illustrative regional office",
    min: 90000,
    max: 115000,
    resume: "Design sample",
    priority: false,
    stage: "Applied",
    favorite: false,
    nextAction: "Prepare a sample portfolio discussion",
    notes: "Example application, not a real submission.",
    duties:
      "Research customer needs, prototype workflows, and document interaction decisions.",
    requirements: [
      "Product portfolio",
      "Prototyping skills",
      "User-research experience",
    ],
    gap: "Portfolio evidence would need to be checked against a real posting.",
    travel: "Illustrative: two office days weekly",
  },
  {
    id: "sample-operations",
    company: "Cedar Example",
    role: "Operations Coordinator",
    career: "Operations",
    workplace: "On-site",
    location: "Illustrative regional office",
    min: 60000,
    max: 75000,
    resume: "Operations sample",
    priority: false,
    stage: "Saved",
    favorite: false,
    nextAction: "Compare workplace preferences",
    notes: "",
    duties:
      "Coordinate scheduling, improve routine processes, and maintain operational records.",
    requirements: [
      "Process coordination",
      "Spreadsheet skills",
      "Cross-team communication",
    ],
    gap: "On-site attendance is an explicit sample constraint.",
    travel: "Illustrative: occasional local travel",
  },
  {
    id: "sample-marketing",
    company: "Elm Example",
    role: "Marketing Specialist",
    career: "Marketing",
    workplace: "Remote",
    location: "United States",
    min: 70000,
    max: 90000,
    resume: "Marketing sample",
    priority: true,
    stage: "Saved",
    favorite: false,
    nextAction: "Review a sample campaign brief",
    notes: "",
    duties:
      "Plan campaign content, coordinate launches, and report on engagement.",
    requirements: [
      "Writing samples",
      "Campaign coordination",
      "Basic analytics",
    ],
    gap: "Actual writing samples are not uploaded or assessed in this demo.",
    travel: "Illustrative: under 10%",
  },
  {
    id: "sample-customer-success",
    company: "Maple Example",
    role: "Customer Success Manager",
    career: "Customer success",
    workplace: "Remote",
    location: "United States",
    min: 85000,
    max: 105000,
    resume: "Customer success sample",
    priority: false,
    stage: "Interviewing",
    favorite: true,
    nextAction: "Outline a sample customer scenario",
    notes: "Example interview stage only.",
    duties:
      "Guide customer onboarding, track account needs, and coordinate product feedback.",
    requirements: [
      "Customer-facing experience",
      "Account planning",
      "Clear written communication",
    ],
    gap: "Travel and state eligibility would require employer verification.",
    travel: "Illustrative: occasional customer visits",
  },
  {
    id: "sample-accounting",
    company: "Willow Example",
    role: "Senior Accountant",
    career: "Accounting",
    workplace: "Hybrid",
    location: "Illustrative regional office",
    min: 90000,
    max: 110000,
    resume: "Accounting sample",
    priority: false,
    stage: "Saved",
    favorite: false,
    nextAction: "Review the sample close responsibilities",
    notes: "",
    duties:
      "Prepare reconciliations, support month-end close, and explain account movements.",
    requirements: [
      "Accounting experience",
      "Reconciliations",
      "Financial reporting",
    ],
    gap: "This is one career field among many, not the product's target restriction.",
    travel: "Illustrative: under 10%",
  },
].map((job) => ({ ...job, ...SAMPLE_FACETS[job.id] }));

const choices = (key) =>
  [...new Set(SAMPLE_JOBS.map((j) => j[key]))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => [value, value]);
export const FILTER_FIELDS = [
  {
    key: "career",
    label: "Career field",
    all: "All career fields",
    options: choices("career"),
  },
  {
    key: "workplace",
    label: "Workplace",
    all: "Any workplace",
    options: [
      ["Remote", "Remote"],
      ["Hybrid", "Hybrid"],
      ["On-site", "On-site"],
    ],
  },
  {
    key: "payFloor",
    label: "Minimum salary",
    all: "Any sample salary",
    default: "0",
    options: [
      ["70000", "$70,000+ minimum"],
      ["90000", "$90,000+ minimum"],
      ["110000", "$110,000+ minimum"],
    ],
  },
  {
    key: "level",
    label: "Experience level",
    all: "Any experience level",
    options: [
      ["Entry-level", "Entry-level"],
      ["Mid-level", "Mid-level"],
      ["Senior", "Senior"],
    ],
  },
  {
    key: "employment",
    label: "Job type",
    all: "Any job type",
    options: choices("employment"),
  },
  {
    key: "industry",
    label: "Industry",
    all: "Any industry",
    options: choices("industry"),
  },
  {
    key: "region",
    label: "Sample location scope",
    all: "Any sample location",
    options: choices("region"),
  },
  {
    key: "travelCap",
    label: "Business travel",
    all: "Any travel amount",
    options: [
      ["0", "No business travel"],
      ["10", "10% or less"],
      ["25", "25% or less"],
      ["unknown", "Not specified"],
    ],
  },
  {
    key: "interviewCap",
    label: "Sample interview steps",
    all: "Any interview length",
    options: [
      ["2", "2 steps or fewer"],
      ["3", "3 steps or fewer"],
      ["4", "4 steps or fewer"],
      ["unknown", "Not specified"],
    ],
  },
  {
    key: "stage",
    label: "Application status",
    all: "Any application status",
    options: STAGES.map((stage) => [stage, stage]),
  },
];
export const FILTER_DEFAULTS = Object.freeze({
  query: "",
  filter: "all",
  ...Object.fromEntries(
    FILTER_FIELDS.map((field) => [field.key, field.default ?? ""]),
  ),
});
export function freshJobs() {
  return structuredClone(SAMPLE_JOBS);
}
function withinCap(value, cap) {
  if (cap === "") return true;
  if (cap === "unknown") return !Number.isFinite(value);
  return (
    Number.isFinite(value) &&
    Number.isFinite(Number(cap)) &&
    value <= Number(cap)
  );
}
export function selectJobs(
  jobs,
  {
    query = "",
    career = "",
    workplace = "",
    payFloor = 0,
    level = "",
    employment = "",
    industry = "",
    region = "",
    travelCap = "",
    interviewCap = "",
    stage = "",
    filter = "all",
    sort = "company",
  } = {},
) {
  const text = query.trim().toLowerCase();
  return jobs
    .filter(
      (j) =>
        (!career || j.career === career) &&
        (!workplace || j.workplace === workplace) &&
        j.min >= Number(payFloor) &&
        (!level || j.level === level) &&
        (!employment || j.employment === employment) &&
        (!industry || j.industry === industry) &&
        (!region || j.region === region) &&
        (!stage || j.stage === stage) &&
        withinCap(j.travelPercent, travelCap) &&
        withinCap(j.interviewSteps, interviewCap) &&
        (!text ||
          [
            j.company,
            j.role,
            j.career,
            j.duties,
            j.notes,
            j.nextAction,
            j.level,
            j.employment,
            j.industry,
            j.region,
            ...j.requirements,
          ]
            .join(" ")
            .toLowerCase()
            .includes(text)) &&
        (filter === "all" ||
          (filter === "remote" && j.workplace === "Remote") ||
          (filter === "priority" && j.priority) ||
          (filter === "pipeline" &&
            ["Applied", "Interviewing", "Offer"].includes(j.stage)) ||
          (filter === "favorite" && j.favorite) ||
          (filter === "interviewing" && j.stage === "Interviewing")),
    )
    .sort(
      sort === "pay"
        ? (a, b) => b.min - a.min
        : sort === "role"
          ? (a, b) => a.role.localeCompare(b.role)
          : (a, b) => a.company.localeCompare(b.company),
    );
}
export function sampleCsv(jobs) {
  const columns = [
    "sample_id",
    "company",
    "role",
    "career",
    "workplace",
    "illustrative_min_usd",
    "illustrative_max_usd",
    "stage",
    "favorite",
    "next_action",
    "notes",
    "data_status",
    "illustrative_level",
    "illustrative_job_type",
    "illustrative_industry",
    "illustrative_location_scope",
    "illustrative_travel_percent",
    "illustrative_interview_steps",
  ];
  const quote = (v) => {
    let s = String(v ?? "");
    if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      columns.map(quote).join(","),
      ...jobs.map((j) =>
        [
          j.id,
          j.company,
          j.role,
          j.career,
          j.workplace,
          j.min,
          j.max,
          j.stage,
          j.favorite,
          j.nextAction,
          j.notes,
          "Fictional sample; not a live posting",
          j.level,
          j.employment,
          j.industry,
          j.region,
          j.travelPercent ?? "Not specified",
          j.interviewSteps ?? "Not specified",
        ]
          .map(quote)
          .join(","),
      ),
    ].join("\r\n")
  );
}
