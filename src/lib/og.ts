import { ImageResponse, loadGoogleFont } from "workers-og";

const WIDTH = 1200;
const HEIGHT = 630;

export async function renderOgCard({
  eyebrow,
  title,
  footer,
}: {
  eyebrow: string;
  title: string;
  footer?: string;
}): Promise<Response> {
  const fontText = `${eyebrow}${title}${footer ?? ""}ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,'"&·`;

  const [regular, semibold] = await Promise.all([
    loadGoogleFont({ family: "Fraunces", weight: 400, text: fontText }),
    loadGoogleFont({ family: "Fraunces", weight: 600, text: fontText }),
  ]);

  const titleSize = title.length > 90 ? 52 : title.length > 50 ? 60 : 72;

  const html = `
    <div style="display: flex; flex-direction: column; justify-content: space-between; width: ${WIDTH}px; height: ${HEIGHT}px; background: #fdfdfb; padding: 80px;">
      <div style="display: flex;">
        <span style="font-family: 'Fraunces'; font-weight: 400; font-size: 22px; letter-spacing: 0.04em; text-transform: uppercase; color: #55534d;">${eyebrow}</span>
      </div>
      <div style="display: flex;">
        <h1 style="font-family: 'Fraunces'; font-weight: 600; font-size: ${titleSize}px; line-height: 1.2; letter-spacing: -0.01em; color: #1a1a1a; margin: 0;">${title}</h1>
      </div>
      <div style="display: flex; align-items: center;">
        <div style="display: flex; width: 56px; height: 6px; background: #a1442a; margin-right: 20px;"></div>
        <span style="font-family: 'Fraunces'; font-size: 22px; color: #55534d;">${footer ?? "matthewrkenney.com"}</span>
      </div>
    </div>
  `;

  return new ImageResponse(html, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Fraunces", data: regular, weight: 400, style: "normal" },
      { name: "Fraunces", data: semibold, weight: 600, style: "normal" },
    ],
  });
}
