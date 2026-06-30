import test from "node:test";
import assert from "node:assert/strict";
import PizZip from "pizzip";
import { detectDocxPlaceholders, normalizePlaceholder } from "../lib/docx-placeholders";

test("normalizePlaceholder cleans merge-field syntax", () => {
  assert.equal(normalizePlaceholder(" MERGEFIELD First Name \\* MERGEFORMAT "), "First_Name");
});

test("detectDocxPlaceholders finds merge, token, and content-control placeholders", () => {
  const zip = new PizZip();
  zip.file(
    "word/document.xml",
    `<w:document>
       <w:t>«StudentID»</w:t>
       <w:t>{{FirstName}}</w:t>
       <w:sdt>
         <w:sdtPr><w:tag w:val="Campus"/></w:sdtPr>
         <w:sdtContent><w:t>Click or tap here to enter text.</w:t></w:sdtContent>
       </w:sdt>
     </w:document>`
  );

  const placeholders = detectDocxPlaceholders(zip.generate({ type: "nodebuffer" }));
  assert.deepEqual(
    placeholders.map((placeholder) => [placeholder.name, placeholder.kind]),
    [
      ["Campus", "content-control"],
      ["FirstName", "text-token"],
      ["StudentID", "merge-field"]
    ]
  );
});
