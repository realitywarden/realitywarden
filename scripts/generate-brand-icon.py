from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRANDING_DIR = ROOT / "assets" / "branding"
PNG_PATH = BRANDING_DIR / "open-reality-studio.png"
ICO_PATH = BRANDING_DIR / "open-reality-studio.ico"


def rounded_rect(draw: ImageDraw.ImageDraw, xy, radius, fill):
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def main() -> None:
    BRANDING_DIR.mkdir(parents=True, exist_ok=True)

    size = 512
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Soft shadow
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    rounded_rect(shadow_draw, (52, 60, 460, 468), 112, (0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    image.alpha_composite(shadow)

    # Main plate
    rounded_rect(draw, (44, 44, 468, 468), 112, (0x12, 0x17, 0x22, 255))

    # Inner gradient-ish panels
    rounded_rect(draw, (68, 68, 444, 444), 96, (0x1B, 0x2C, 0x47, 255))
    rounded_rect(draw, (92, 92, 420, 420), 84, (0x00, 0x66, 0xCC, 255))

    # Grid/runtime motif
    for offset in range(132, 392, 52):
        draw.line((offset, 132, offset, 380), fill=(255, 255, 255, 36), width=3)
        draw.line((132, offset, 380, offset), fill=(255, 255, 255, 36), width=3)

    # Stylized O
    draw.ellipse((126, 126, 310, 310), outline=(255, 255, 255, 245), width=24)
    draw.ellipse((166, 166, 270, 270), fill=(0x00, 0x66, 0xCC, 255))

    # Stylized R stem
    draw.rounded_rectangle((246, 160, 278, 360), radius=14, fill=(255, 255, 255, 245))
    # Stylized R bowl
    draw.arc((220, 128, 360, 274), start=292, end=108, fill=(255, 255, 255, 245), width=24)
    # Stylized R leg
    draw.line((272, 258, 360, 348), fill=(255, 255, 255, 245), width=24)

    # Accent node
    draw.ellipse((330, 118, 380, 168), fill=(0x34, 0xD3, 0x99, 255))
    draw.ellipse((342, 130, 368, 156), fill=(0xC8, 0xFA, 0xE5, 255))

    image.save(PNG_PATH)
    image.save(ICO_PATH, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])


if __name__ == "__main__":
    main()
