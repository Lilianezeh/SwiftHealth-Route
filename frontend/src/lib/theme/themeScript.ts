/** The script that sets the theme before the first paint, so a dark page never flashes white. Requirements: NFR-10, NFR-01.
 * It is put in the `<head>` of every page (app/layout.tsx) as a plain inline script: it must run before the body is drawn, so it cannot
 * be a React effect. It does what `lib/theme/theme.ts` does (`readChoice`, `resolveTheme`, `applyTheme`; a test runs it against them
 * for every choice), and one thing more: while the choice is System it follows the system if the person changes it with the page open.
 * No outside address, no cookie, no request. It never throws: a browser without storage or `matchMedia` is treated as System, light.
 */
import { DARK_QUERY, THEME_KEY } from "@/lib/theme/theme";

export const THEME_SCRIPT = `(function(){try{
var root=document.documentElement;
var query=window.matchMedia?window.matchMedia(${JSON.stringify(DARK_QUERY)}):null;
function apply(){
var kept=null;try{kept=window.localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}
var theme=kept==="light"||kept==="dark"?kept:(query&&query.matches?"dark":"light");
root.setAttribute("data-theme",theme)}
apply();
if(query&&query.addEventListener)query.addEventListener("change",apply)
}catch(e){}})();`;
