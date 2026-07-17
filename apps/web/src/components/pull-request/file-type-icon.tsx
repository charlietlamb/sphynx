import { FileIcon } from "@phosphor-icons/react";
import {
  siCss,
  siDocker,
  siGnubash,
  siGo,
  siGraphql,
  siHtml5,
  siJavascript,
  siJson,
  siMarkdown,
  siPostgresql,
  siPrisma,
  siPython,
  siReact,
  siRust,
  siSvg,
  siToml,
  siTypescript,
  siYaml,
} from "simple-icons";

const BY_EXTENSION: Record<string, string> = {
  cjs: siJavascript.path,
  css: siCss.path,
  cts: siTypescript.path,
  docker: siDocker.path,
  go: siGo.path,
  graphql: siGraphql.path,
  html: siHtml5.path,
  js: siJavascript.path,
  json: siJson.path,
  jsonc: siJson.path,
  jsx: siReact.path,
  md: siMarkdown.path,
  mdx: siMarkdown.path,
  mjs: siJavascript.path,
  mts: siTypescript.path,
  prisma: siPrisma.path,
  py: siPython.path,
  rs: siRust.path,
  sh: siGnubash.path,
  sql: siPostgresql.path,
  svg: siSvg.path,
  toml: siToml.path,
  ts: siTypescript.path,
  tsx: siReact.path,
  yaml: siYaml.path,
  yml: siYaml.path,
  zsh: siGnubash.path,
};

const EXTENSION_PATTERN = /\.([a-z0-9]+)$/i;

function iconPath(path: string) {
  const base = path.slice(path.lastIndexOf("/") + 1).toLowerCase();
  if (base.startsWith("dockerfile")) {
    return BY_EXTENSION.docker;
  }
  const extension = EXTENSION_PATTERN.exec(base)?.[1];
  return extension ? BY_EXTENSION[extension] : undefined;
}

interface FileTypeIconProps {
  className?: string;
  path: string;
}

export function FileTypeIcon({ className, path }: FileTypeIconProps) {
  const icon = iconPath(path);
  if (!icon) {
    return <FileIcon className={className} />;
  }
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d={icon} />
    </svg>
  );
}
