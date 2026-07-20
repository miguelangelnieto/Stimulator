// This is a standalone application for the tray
// It have is own imports
import {
  Indicator,
  IndicatorCategory,
  IndicatorStatus,
} from "@sigmasd/gtk/appindicator";
import * as Gtk from "@sigmasd/gtk/gtk3";
import {
  ioAddWatch,
  IOCondition,
  UnixSignal,
  unixSignalAdd,
} from "@sigmasd/gtk/glib";
import { APP_ID, UI_LABELS } from "../consts.ts";
import { MESSAGES } from "./messages.ts";

// since this app is used with ipc, this is a better name
const sendMsg = console.log;

if (import.meta.main) {
  Gtk.init();

  const indicator = new Indicator(
    `${APP_ID}-tray`,
    `${APP_ID}-tray`,
    IndicatorCategory.APPLICATION_STATUS,
  );
  indicator.setTitle(UI_LABELS.Stimulator);

  const menu = new Gtk.Menu();

  const showApp = new Gtk.MenuItem(UI_LABELS.Show);
  const closeApp = new Gtk.MenuItem(UI_LABELS.Close);
  showApp.connect(
    "activate",
    () => {
      sendMsg(MESSAGES.Show);
      showApp.hide();
    },
  );
  closeApp.connect(
    "activate",
    () => {
      sendMsg(MESSAGES.Close);
      Gtk.mainQuit();
    },
  );

  let first_try = true;
  ioAddWatch(
    0, /*stdin*/
    IOCondition.IN,
    () => {
      const buf = new Uint8Array(512);
      const n = Deno.stdin.readSync(buf);
      if (!n) throw new Error("recieved an empty message");

      const message = new TextDecoder()
        .decode(buf.slice(0, n))
        .trim();
      switch (message) {
        case MESSAGES.Activate:
          indicator.setStatus(IndicatorStatus.ACTIVE);
          // NOTE: if thhe indicator is not connected after being set to active, this means the system doesn't support tray icons, so exit
          if (!indicator.props.connected) {
            // The icon might take some time to be active (happens in kde)
            // Give it one more chance
            if (!first_try) {
              // The user will recive this error in the logs:
              // `(.:11550): Gtk-CRITICAL **: 05:57:05.429: gtk_widget_get_scale_factor: assertion 'GTK_IS_WIDGET (widget)' failed`
              // becuase they don't have tray icon support, its harmless though
              Gtk.mainQuit();
            } else {
              first_try = false;
            }
          }
          break;
        case MESSAGES.Deactivate:
          indicator.setStatus(IndicatorStatus.PASSIVE);
          break;
        case MESSAGES.Hide:
          indicator.setStatus(IndicatorStatus.PASSIVE);
          break;
        case MESSAGES.Close:
          Gtk.mainQuit();
          break;
        case MESSAGES.showShowButton:
          showApp.show();
          break;
        case MESSAGES.HideShowButton:
          showApp.hide();
          break;
        default:
          throw new Error(`Incorrect message: '${message}'`);
      }

      return true;
    },
  );

  // NOTE: the show item is always in the menu but only visible while the app
  // is in the background (removing/re-adding it would drop its last reference)
  menu.prepend(showApp);
  menu.append(closeApp);
  menu.showAll();
  showApp.hide();
  indicator.setMenu(menu);

  unixSignalAdd(UnixSignal.SIGINT, () => {
    Gtk.mainQuit();
    return false;
  });

  Gtk.main();
}
