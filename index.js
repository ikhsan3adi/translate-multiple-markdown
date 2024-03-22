const { readFileSync, writeFileSync, readdirSync } = require("fs");
const { join } = require("path");
const core = require("@actions/core");
const $ = require("@k3rn31p4nic/google-translate-api");
const unified = require("unified");
const parse = require("remark-parse");
const stringify = require("remark-stringify");
const visit = require("unist-util-visit");
const simpleGit = require("simple-git");
const git = simpleGit();

const toAst = (markdown) => {
  return unified().use(parse).parse(markdown);
};

const toMarkdown = (ast) => {
  return unified().use(stringify).stringify(ast);
};

const mainDir = ".";
const lang = core.getInput("LANG") || "en";
const mdFiles = core.getInput("FILES").split(/\r|\n/);

async function translate(files) {
  for (const file of files) {
    const readme = readFileSync(join(mainDir, file), { encoding: "utf8" });
    const readmeAST = toAst(readme);
    console.log(`${file} AST CREATED AND READ`);

    let originalText = [];

    visit(readmeAST, async (node) => {
      if (node.type === "text") {
        originalText.push(node.value);
        node.value = (await $(node.value, { to: lang })).text;
      }
    });

    const translatedText = originalText.map(async (text) => {
      return (await $(text, { to: lang })).text;
    });

    await writeToFile(file, readmeAST, translatedText);
  }
}

async function writeToFile(filename, readmeAST, translatedText) {
  await Promise.all(translatedText);
  writeFileSync(
    join(mainDir, `${filename}.${lang}.md`),
    toMarkdown(readmeAST),
    "utf8"
  );
  console.log(`${filename}.${lang}.md written`);
}

async function commitChanges() {
  console.log("commit started");
  await git.add("./*");
  await git.addConfig("user.name", "github-actions[bot]");
  await git.addConfig(
    "user.email",
    "41898282+github-actions[bot]@users.noreply.github.com"
  );
  await git.commit(
    `docs: Added README."${lang}".md translation via https://github.com/dephraiim/translate-readme`
  );
  console.log("finished commit");
  await git.push();
  console.log("pushed");
}

async function translateReadme() {
  try {
    await translate(mdFiles);
    await commitChanges();
    console.log("Done");
  } catch (error) {
    throw new Error(error);
  }
}

translateReadme();
