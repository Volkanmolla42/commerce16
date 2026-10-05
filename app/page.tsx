import { Carousel } from "@/components/carousel";
import { ThreeItemGrid } from "@/components/grid/three-items";
import Footer from "@/components/layout/footer";

export const prefetch = "partial";

export const metadata = {
  description:
    "Yüksek performanslı e-ticaret mağazası.",
  openGraph: {
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      <ThreeItemGrid />
      <Carousel />
      <Footer />
    </>
  );
}
