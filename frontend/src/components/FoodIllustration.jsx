import { Box } from "@mui/material";
import atlas from "../assets/food-illustrations.webp";
export const pastelColors = [
  "#FBE9EE",
  "#FFF2D7",
  "#F4E9DE",
  "#E7F1E9",
  "#EFE9F8",
  "#FCEADB",
];
export default function FoodIllustration({ kind = 0, size = 64, sx = {} }) {
  const index = (((Number(kind) || 0) % 6) + 6) % 6;
  return (
    <Box
      aria-hidden="true"
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        backgroundImage: `url(${atlas})`,
        backgroundSize: "300% 200%",
        backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%`,
        backgroundRepeat: "no-repeat",
        ...sx,
      }}
    />
  );
}
