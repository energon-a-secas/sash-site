/**
 * The real-issuer blocklist. CONTRACTS.md C11.3.
 *
 * One export: an array of lowercase terms. `convex/lib/blocklist.ts` matches
 * them case-insensitively, accent-folded and whole-word, after collapsing runs
 * of non-alphanumeric characters to single spaces, so a term needs no regex and
 * no case variant. A term containing spaces matches as a phrase of whole words.
 * `templates:publish` runs the check before it writes anything and refuses on a
 * hit, which is what makes this a control rather than a design rule.
 *
 * What belongs here: **the name or the credential mark of a real body that
 * issues credentials.** What does not: a technology. The distinction matters
 * because a parody badge about a tool is the product working, and a parody
 * badge claiming a real issuer awarded it is the thing C11 exists to stop.
 * `terraform` and `github` sit here only because C11.3 froze them by name; on
 * the rule above they would not have been added, and nothing else of that shape
 * was added to keep them company.
 *
 * Matching is whole-word, so the near misses below are allowed and are checked
 * by exercising the deployed publish mutation, not by reading this comment:
 *
 *   Amazonian     does not trip  amazon
 *   Awkward       does not trip  aws
 *   Sapling       does not trip  sap
 *   Oracular      does not trip  oracle
 *   Azurite       does not trip  azure
 *   Terraforming  does not trip  terraform
 *   Giacomo       does not trip  giac
 *   Oktoberfest   does not trip  okta
 *   Sanskrit      does not trip  sans
 *
 * Two limits worth knowing before someone trusts this more than it deserves.
 *
 *   **A hyphen is a word boundary, so "Snowflake-free" folds to two words and
 *   is refused.** That is the matcher working: the term is present as a whole
 *   word. It is recorded because it looks like a false positive until you fold
 *   the string by hand.
 *
 *   **Plurals are not folded.** " snowflakes " does not contain " snowflake ",
 *   so a plural walks past the list. That is fine against an honest author
 *   naming a real issuer, which is the threat this addresses, and useless
 *   against someone deliberately evading it. Nothing here pretends otherwise.
 *
 *   **Three frozen terms are ordinary English words**: `sans` (so "sans serif"
 *   is refused), `sap` and `oracle`. C11.3 names all three, so they ship. The
 *   cost is a rare false refusal with a message that says which term matched,
 *   and the author can reword. Removing one is a data edit, not a deploy.
 *
 * Owned by D1. Growing the list is a data change with no schema change, which
 * is the whole reason C11.3 requires it to live here.
 */
export const BLOCKLIST: string[] = [
  // Cloud and platform vendors that run credential programmes.
  "aws",
  "amazon",
  "amazon web services",
  "azure",
  "microsoft",
  "mcse",
  "google",
  "google cloud",
  "gcp",
  "alibaba cloud",
  "huawei",
  "digitalocean",
  "oracle",
  "salesforce",
  "mulesoft",
  "sap",
  "servicenow",
  "snowflake",
  "snowpro",
  "databricks",
  "mongodb",
  "atlassian",
  "gitlab",
  "github",
  "hashicorp",
  "terraform",
  "vmware",
  "broadcom",
  "red hat",
  "ibm",
  "nvidia",
  "okta",
  "adobe",
  "autodesk",
  "anthropic",
  "openai",
  "tableau",
  "hubspot",
  "semrush",
  "splunk",

  // Foundations, consortia and the security certification bodies.
  "linux foundation",
  "cncf",
  "cka",
  "ckad",
  "cks",
  "the open group",
  "togaf",
  "isaca",
  "cisa",
  "cism",
  "crisc",
  "isc2",
  "cissp",
  "ccsp",
  "comptia",
  "ec-council",
  "ceh",
  "offensive security",
  "oscp",
  "oswe",
  "osce",
  "sans",
  "giac",
  "cisco",
  "ccna",
  "ccnp",
  "ccie",
  "juniper",
  "fortinet",
  "palo alto networks",
  "crowdstrike",
  "sophos",
  "qualys",
  "rapid7",
  "citrix",
  "netapp",
  "veeam",
  "siemens",
  "rockwell automation",

  // Project, process and quality bodies.
  "pmi",
  "pmp",
  "capm",
  "prince2",
  "axelos",
  "peoplecert",
  "itil",
  "scrum alliance",
  "scrum org",
  "scaled agile",
  "six sigma",
  "asq",
  "iso 9001",
  "iso 27001",
  "nist",

  // The platforms that issue and host other people's credentials. Sash is a
  // sibling of these, which is exactly why naming one as the issuer of a Sash
  // credential is the claim that has to be refused.
  "credly",
  "badgr",
  "pearson",
  "coursera",
  "udemy",
  "edx",
  "udacity",
  "pluralsight",
  "datacamp",
  "codecademy",
  "linkedin learning",
  "duolingo",

  // Bodies outside software whose marks carry the same weight.
  "cfa institute",
  "cpa",
  "osha",
  "nebosh",
  "red cross",
  "padi",
  "faa",
  "easa",
  "iata",
  "toefl",
  "ielts",
];
