import { getYoutubeEmbedUrl, htmlToPlainText } from "./htmlToPlainText";

test("외부 HTML의 실행 가능한 요소를 제거한다", () => {
  expect(htmlToPlainText('<p>줄거리<br>계속</p><script>alert("xss")</script>')).toBe("줄거리\n계속");
});

test("유효한 YouTube 트레일러 ID만 허용한다", () => {
  expect(getYoutubeEmbedUrl({ site: "youtube", id: "abc_DEF-123" })).toBe(
    "https://www.youtube.com/embed/abc_DEF-123",
  );
  expect(getYoutubeEmbedUrl({ site: "youtube", id: 'x" onload="alert(1)' })).toBeNull();
});
