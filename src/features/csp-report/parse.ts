import { z } from "zod";

/** Reports are logged: every text field is capped. */
export const MAX_FIELD_LENGTH = 512;
/** Each violation is a log line: a batch is capped well below a flood. */
const MAX_BATCH = 10;

export interface CspViolation {
  readonly documentUrl: string | null;
  readonly blockedUrl: string | null;
  readonly directive: string | null;
  readonly disposition: string | null;
  readonly sourceFile: string | null;
  readonly line: number | null;
  readonly column: number | null;
  readonly sample: string | null;
}

// Browsers send null for unknown fields (source file, line, column).
const text = z.string().nullish();
const position = z.number().int().nonnegative().nullish();

// report-uri (Firefox, older browsers): one report per request.
const legacySchema = z.object({
  "csp-report": z.object({
    "document-uri": text,
    "blocked-uri": text,
    "violated-directive": text,
    "effective-directive": text,
    disposition: text,
    "source-file": text,
    "line-number": position,
    "column-number": position,
    "script-sample": text,
  }),
});

// Reporting API (report-to): a batch of reports of any type, each checked on
// its own so one malformed member does not discard the others.
const reportingApiSchema = z.array(z.unknown()).max(MAX_BATCH);

const reportSchema = z.object({
  type: z.literal("csp-violation"),
  body: z.unknown(),
});

const violationBodySchema = z.object({
  documentURL: text,
  blockedURL: text,
  effectiveDirective: text,
  disposition: text,
  sourceFile: text,
  lineNumber: position,
  columnNumber: position,
  sample: text,
});

function cap(value: string | null | undefined): string | null {
  return value === null || value === undefined
    ? null
    : value.slice(0, MAX_FIELD_LENGTH);
}

/**
 * A URL without its query and fragment, which can carry tokens or personal
 * data. Built from a copy, so opaque origins (data:, extensions) keep their
 * scheme and host.
 */
function withoutQuery(value: string | null | undefined): string | null {
  if (value === null || value === undefined || !URL.canParse(value)) {
    return cap(value);
  }
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return cap(url.href);
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function fromLegacy(input: unknown): readonly CspViolation[] | undefined {
  const parsed = legacySchema.safeParse(input);
  if (!parsed.success) {
    return undefined;
  }
  const report = parsed.data["csp-report"];
  return [
    {
      documentUrl: withoutQuery(report["document-uri"]),
      blockedUrl: withoutQuery(report["blocked-uri"]),
      directive: cap(
        report["effective-directive"] ?? report["violated-directive"],
      ),
      disposition: cap(report.disposition),
      sourceFile: withoutQuery(report["source-file"]),
      line: report["line-number"] ?? null,
      column: report["column-number"] ?? null,
      sample: cap(report["script-sample"]),
    },
  ];
}

function fromReportingApi(input: unknown): readonly CspViolation[] | undefined {
  const parsed = reportingApiSchema.safeParse(input);
  if (!parsed.success) {
    return undefined;
  }
  return parsed.data.flatMap((member) => {
    const report = reportSchema.safeParse(member);
    const body = violationBodySchema.safeParse(
      report.success ? report.data.body : undefined,
    );
    if (!body.success) {
      return [];
    }
    const { data } = body;
    return [
      {
        documentUrl: withoutQuery(data.documentURL),
        blockedUrl: withoutQuery(data.blockedURL),
        directive: cap(data.effectiveDirective),
        disposition: cap(data.disposition),
        sourceFile: withoutQuery(data.sourceFile),
        line: data.lineNumber ?? null,
        column: data.columnNumber ?? null,
        sample: cap(data.sample),
      },
    ];
  });
}

/**
 * The CSP violations of a report request, normalized; undefined when the
 * request is not a report at all (wrong media type, malformed JSON or shape).
 */
export function parseCspReports(
  contentType: string,
  body: string,
): readonly CspViolation[] | undefined {
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  if (mediaType === "application/csp-report") {
    return fromLegacy(parseJson(body));
  }
  if (mediaType === "application/reports+json") {
    return fromReportingApi(parseJson(body));
  }
  return undefined;
}
