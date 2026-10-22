/** Source span of a one-based object member, including its own preceding comments. */
export function memberBody(text,line,indent){
 const lines=text.split('\n'),re=new RegExp(`^ {${indent}}[a-zA-Z_$][\\w$]*\\s*(?::|\\()`);
 // `line` is already the zero-based index of the next line. A member there is a boundary too.
 let end=line;while(end<lines.length&&!re.test(lines[end]))end++;
 while(end>line&&/^\s*(\/\/|\/\*|\*)/.test(lines[end-1]))end--;
 let start=line-1;while(start>0&&/^\s*(\/\/|\/\*|\*)/.test(lines[start-1]))start--;
 return lines.slice(start,end).join('\n');
}
