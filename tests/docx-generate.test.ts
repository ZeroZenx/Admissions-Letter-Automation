import test from "node:test";
import assert from "node:assert/strict";
import PizZip from "pizzip";
import { generateDocxFromTemplate } from "../lib/docx-generate";

test("generateDocxFromTemplate replaces text and merge placeholders with escaped values", () => {
  const zip = new PizZip();
  zip.file("word/document.xml", "<w:document><w:t>{{FirstName}}</w:t><w:t>«Program»</w:t></w:document>");

  const output = generateDocxFromTemplate(zip.generate({ type: "nodebuffer" }), {
    FirstName: "Asha & Co",
    Program: "Nursing <RN>"
  });
  const xml = new PizZip(output).file("word/document.xml")?.asText();

  assert.match(xml ?? "", /Asha &amp; Co/);
  assert.match(xml ?? "", /Nursing &lt;RN&gt;/);
});

test("generateDocxFromTemplate replaces content-control placeholder text by tag", () => {
  const zip = new PizZip();
  zip.file(
    "word/document.xml",
    `<w:document>
      <w:sdt>
        <w:sdtPr><w:tag w:val="Campus"/></w:sdtPr>
        <w:sdtContent><w:r><w:t>Click or tap here to enter text.</w:t></w:r></w:sdtContent>
      </w:sdt>
    </w:document>`
  );

  const output = generateDocxFromTemplate(zip.generate({ type: "nodebuffer" }), {
    Campus: "Chaguanas"
  });
  const xml = new PizZip(output).file("word/document.xml")?.asText();

  assert.match(xml ?? "", /Chaguanas/);
  assert.doesNotMatch(xml ?? "", /Click or tap here to enter text\./);
});
