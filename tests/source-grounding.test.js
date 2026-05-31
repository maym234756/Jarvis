import test from "node:test";
import assert from "node:assert/strict";
import { composeGroundedAnswer } from "../packages/answers/index.js";

test("grounded answer extracts current US president from current White House source", () => {
  const answer = composeGroundedAnswer({
    taskType: "research",
    message: "Who is the President of the US?",
    toolResults: [{
      tool: "research.run",
      ok: true,
      sources: [{
        ok: true,
        title: "President Donald J. Trump - The White House",
        url: "https://www.whitehouse.gov/administration/donald-j-trump/",
        source_type: "authoritative",
        snippets: ["Donald J. Trump 45th & 47th President of the United States"]
      }, {
        ok: true,
        title: "Donald J. Trump - The White House",
        url: "https://trumpwhitehouse.archives.gov/people/donald-j-trump/",
        source_type: "authoritative",
        snippets: ["Historical material frozen in time."]
      }]
    }]
  });

  assert.ok(answer.startsWith("Donald J. Trump is the current President of the United States."));
  assert.ok(answer.includes("https://www.whitehouse.gov/administration/donald-j-trump/"));
});
