import Description from "@/component/Description";
import PlayList from "@/component/PlayList";
import RecommendList from "@/component/RecommendList";
import { getInfoList, getRecommendByCategoryId, getVideoDetail, IVideoDetail } from "@/service/video";
import { NButton, NImage, NSkeleton } from "naive-ui";
import { computed, defineComponent, onMounted, PropType, ref } from "vue";
import { onBeforeRouteUpdate, useRouter } from "vue-router";

export default defineComponent({
  props: {
    videoId: {
      type: Number as PropType<number>,
      default: null,
    },
  },
  emits: [],
  setup: (props, ctx) => {
    const router = useRouter();
    const video = ref<IVideoDetail>();
    const infoList = computed(() => {
      return getInfoList(video.value);
    });

    let videoId = Number(props.videoId);

    function fetchData() {
      getVideoDetail(videoId).then(data => {
        video.value = data;
        // 推荐
        getRecommendByCategoryId(data.category_id);
      });
    }

    onMounted(() => {
      fetchData();
    });

    onBeforeRouteUpdate(to => {
      videoId = Number(to.params.videoId);
      fetchData();
    });

    return () => (
      <>
        <div class="video-info d-flex mar-b-5-item">
          <div class="video-cover">
            {video.value ? (
              <NImage src={video.value?.cover} objectFit="fill" class="full-width"></NImage>
            ) : (
              <NSkeleton height="400px"></NSkeleton>
            )}
          </div>
          <div class="flex-item-extend d-flex direction-column">
            <h1 class="font-xlg mar-b-5-item">{video.value ? video.value.title : <NSkeleton height="30px"></NSkeleton>}</h1>
            {video.value ? (
              <>
                {infoList.value.map(info => (
                  <div class="mar-b-4-item d-flex" key={info.value}>
                    <span class="font-gray font-small mar-r-3">{info.text}</span>
                    <span class="flex-item-extend">{info.value}</span>
                  </div>
                ))}
                {video.value.description ? (
                  <div class="mar-b-5-item d-flex">
                    <span class="font-gray font-small mar-r-3">简介</span>
                    <span class="flex-item-extend">
                      <Description text={video.value.description} />
                    </span>
                  </div>
                ) : null}
                <div class="d-flex align-items-center justify-center">
                  <NButton
                    size="large"
                    type="primary"
                    onClick={() => {
                      router.push({ name: "play", params: { videoId: video.value?.id, playId: video.value?.playlist[0].id } });
                    }}
                  >
                    立即播放
                  </NButton>
                </div>
              </>
            ) : (
              <>
                {new Array(5).fill(1).map((v, i) => (
                  <NSkeleton height="20px" text class="mar-b-3-item" key={i}></NSkeleton>
                ))}
                <NSkeleton height="100px" text></NSkeleton>
              </>
            )}
          </div>
        </div>
        {video.value ? (
          <PlayList
            playlist={video.value.playlist}
            onClick={({ id: playId }) => router.push({ name: "play", params: { videoId, playId } })}
          />
        ) : (
          <div class="mar-t-6">
            <NSkeleton height="50px" text class="mar-b-3-item"></NSkeleton>
            <NSkeleton height="50px" text class="mar-b-3-item"></NSkeleton>
            <NSkeleton height="50px" text class="mar-b-3-item"></NSkeleton>
          </div>
        )}
        <RecommendList videoId={videoId} />
      </>
    );
  },
});
