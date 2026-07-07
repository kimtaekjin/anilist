import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";

const TEXT = {
  loginRequired: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.",
  titleRequired: "\uC81C\uBAA9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694.",
  titleTooLong: "\uC81C\uBAA9\uC740 \uCD5C\uB300 30\uC790\uAE4C\uC9C0 \uC785\uB825\uD574\uC8FC\uC138\uC694.",
  contentTooShort: "\uB0B4\uC6A9\uC740 10\uC790 \uC774\uC0C1 \uC785\uB825\uD574\uC8FC\uC138\uC694.",
  editDone: "\uAC8C\uC2DC\uAE00\uC744 \uC218\uC815\uD588\uC2B5\uB2C8\uB2E4.",
  createDone: "\uAC8C\uC2DC\uAE00\uC744 \uC791\uC131\uD588\uC2B5\uB2C8\uB2E4.",
  serverError: "\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
  editHeading: "\uAC8C\uC2DC\uAE00 \uC218\uC815",
  createHeading: "\uC790\uC720\uAC8C\uC2DC\uD310 \uAE00\uC4F0\uAE30",
  guide: "\uC2A4\uD3EC\uC77C\uB7EC\uB098 \uAD11\uACE0\uC131 \uB0B4\uC6A9\uC740 \uC790\uC81C\uD574\uC8FC\uC138\uC694.",
  titleLabel: "\uC81C\uBAA9",
  titlePlaceholder: "\uC81C\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694",
  titleHelp: "\uC81C\uBAA9\uC740 \uCD5C\uB300 30\uC790\uAE4C\uC9C0 \uC785\uB825 \uAC00\uB2A5\uD569\uB2C8\uB2E4.",
  contentLabel: "\uB0B4\uC6A9",
  contentPlaceholder: "\uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694",
  contentHelp: "\uC11C\uB85C\uB97C \uC874\uC911\uD558\uB294 \uAC8C\uC2DC\uD310 \uBB38\uD654\uB97C \uB9CC\uB4E4\uC5B4\uC8FC\uC138\uC694.",
  cancel: "\uCDE8\uC18C",
  submit: "\uB4F1\uB85D",
};

export default function PostWritePage() {
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_CLIENT_URL;
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    if (!user) {
      alert(TEXT.loginRequired);
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (isEdit) {
      axios.get(`${API_URL}/post/${id}`).then((res) => {
        setTitle(res.data.title);
        setContent(res.data.content);
      });
    }
  }, [isEdit, id, API_URL]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert(TEXT.titleRequired);
      return;
    }

    if (title.trim().length > 30) {
      alert(TEXT.titleTooLong);
      return;
    }

    if (content.trim().length < 10) {
      alert(TEXT.contentTooShort);
      return;
    }

    const payload = {
      title: title.trim(),
      content: content.trim(),
    };

    try {
      const res = isEdit
        ? await axios.put(`${API_URL}/post/${id}`, payload, { withCredentials: true })
        : await axios.post(`${API_URL}/post`, payload, { withCredentials: true });

      if (res) {
        alert(isEdit ? TEXT.editDone : TEXT.createDone);
        navigate("/board");
      }
    } catch (error) {
      if (error.response) {
        alert(error.response.data.message);
      } else {
        alert(TEXT.serverError);
      }
    }
  };

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-lg border border-stone-100/10 bg-[#181816] shadow-xl shadow-black/25">
        <div className="border-b border-stone-100/10 bg-stone-100/5 px-6 py-5">
          <h2 className="text-xl font-bold text-stone-50">{isEdit ? TEXT.editHeading : TEXT.createHeading}</h2>
          <p className="mt-1 text-sm text-stone-400">{TEXT.guide}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-sm font-bold text-stone-300">{TEXT.titleLabel}</label>
            <input
              type="text"
              value={title}
              maxLength={30}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={TEXT.titlePlaceholder}
              className="h-11 w-full rounded-md border border-stone-100/10 bg-[#10100f] px-3 text-base text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
            />
            <p className="mt-1 text-xs text-stone-500">{TEXT.titleHelp}</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-stone-300">{TEXT.contentLabel}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={TEXT.contentPlaceholder}
              className="h-96 w-full resize-none rounded-md border border-stone-100/10 bg-[#10100f] p-3 text-sm leading-relaxed text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15"
            />
            <p className="mt-1 text-xs text-stone-500">{TEXT.contentHelp}</p>
          </div>

          <div className="flex items-center justify-between border-t border-stone-100/10 pt-5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-md border border-stone-100/15 px-4 py-2 text-sm font-semibold text-stone-300 transition hover:border-amber-500 hover:text-amber-300"
            >
              {TEXT.cancel}
            </button>

            <button
              type="submit"
              className="rounded-md bg-red-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/20"
            >
              {TEXT.submit}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
