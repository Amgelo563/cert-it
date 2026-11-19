import type { SiteUrl } from '../../http/url/SiteUrl';
import { AbstractFileServer } from './AbstractFileServer';
import type { ServedFile } from './FileServer';

type AccelFileServerOptions = {
  siteUrl: SiteUrl;
};

/** Sends PDFs through nginx: answers with an empty body and `X-Accel-Redirect` to `{base_path}/_files/<course_id>/<code>.pdf`, which nginx maps to `data/certificates/` (`files.serve: accel`). */
export class AccelFileServer extends AbstractFileServer {
  /** Internal nginx location the files are served from, relative to the base path. */
  public static readonly FilesPath = '/_files';

  protected static readonly RedirectHeader = 'X-Accel-Redirect';

  protected readonly siteUrl: SiteUrl;

  constructor(options: AccelFileServerOptions) {
    super();
    this.siteUrl = options.siteUrl;
  }

  // nginx answers Range and HEAD requests itself
  public override serve(
    _request: Request,
    file: ServedFile,
  ): Promise<Response> {
    const headers = this.createHeaders(file);
    const name = `${encodeURIComponent(file.code)}.pdf`;
    headers.set(
      AccelFileServer.RedirectHeader,
      this.siteUrl.path(
        `${AccelFileServer.FilesPath}/${file.courseId}/${name}`,
      ),
    );

    return Promise.resolve(new Response(null, { headers }));
  }
}
