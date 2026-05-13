import {
  AudioOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PauseCircleOutlined,
  SendOutlined,
  SoundOutlined,
  StarFilled,
  StarOutlined,
  UnlockOutlined
} from '@ant-design/icons';
import { Button, DatePicker, Empty, Input, Popconfirm, Segmented, Space, Tag, message } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';

type RecordKind = 'comment' | 'audio';
type Visibility = 'private' | 'public';
type TabKey = 'public' | 'personal' | 'favorites';

type PersonalRecord = {
  id: string;
  kind: RecordKind;
  content: string;
  createdAt: string;
  visibility: Visibility;
  publisher: string;
  publishedAt?: string;
  duration?: number;
  audioUrl?: string;
  summaryTitle?: string;
  summary?: string;
};

type PublicComment = {
  id: string;
  sourceRecordId?: string;
  author: string;
  owner: 'me' | 'other';
  content: string;
  createdAt: string;
  summaryTitle?: string;
};

type FavoriteComment = PublicComment & {
  favoritedAt: string;
};

type Props = {
  chartId: string;
  chartTitle: string;
};

const CURRENT_USER = '我';

function personalKey(chartId: string) {
  return `strategy-dashboard-chart-personal-records:${chartId}`;
}

function publicKey(chartId: string) {
  return `strategy-dashboard-chart-public-comments:${chartId}`;
}

function favoriteKey(chartId: string) {
  return `strategy-dashboard-chart-favorite-comments:${chartId}`;
}

function readStorageList<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T[] : [];
  } catch {
    return [];
  }
}

function writeStorageList<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function inTimeRange(value: string, range: [Dayjs | null, Dayjs | null] | null) {
  if (!range?.[0] || !range?.[1]) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  return time >= range[0].startOf('day').valueOf() && time <= range[1].endOf('day').valueOf();
}

function createSummary(chartTitle: string) {
  return {
    summaryTitle: `${chartTitle}观察纪要`,
    summary: `${chartTitle}语音纪要：关注当前指标变化、拐点位置和后续验证信号，建议纳入后续策略跟踪。`
  };
}

function demoPublicComment(chartTitle: string): PublicComment {
  return {
    id: `demo-public-${chartTitle}`,
    author: '研究员A',
    owner: 'other',
    summaryTitle: `${chartTitle}跟踪提醒`,
    content: `关注${chartTitle}近期斜率变化，建议结合策略信号继续观察。`,
    createdAt: new Date(Date.now() - 1000 * 60 * 26).toISOString()
  };
}

export default function ChartCollaborationPanel({ chartId, chartTitle }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('public');
  const [inputMode, setInputMode] = useState<RecordKind>('comment');
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [expandedPublicIds, setExpandedPublicIds] = useState<string[]>([]);
  const [expandedPersonalIds, setExpandedPersonalIds] = useState<string[]>([]);
  const [expandedFavoriteIds, setExpandedFavoriteIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [publicComments, setPublicComments] = useState<PublicComment[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [favoriteComments, setFavoriteComments] = useState<FavoriteComment[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordStartedAt, setRecordStartedAt] = useState<number>();
  const [editingRecordId, setEditingRecordId] = useState<string>();
  const [editingPublicId, setEditingPublicId] = useState<string>();
  const [editTitleDraft, setEditTitleDraft] = useState('');
  const [editContentDraft, setEditContentDraft] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const storage = useMemo(() => ({
    personal: personalKey(chartId),
    public: publicKey(chartId),
    favorites: favoriteKey(chartId)
  }), [chartId]);

  useEffect(() => {
    const storedPublic = readStorageList<PublicComment>(storage.public);
    setPublicComments(storedPublic.length > 0 ? storedPublic : [demoPublicComment(chartTitle)]);
    setPersonalRecords(readStorageList<PersonalRecord>(storage.personal));
    setFavoriteComments(readStorageList<FavoriteComment>(storage.favorites));
  }, [chartTitle, storage.favorites, storage.personal, storage.public]);

  const persistPublic = (next: PublicComment[]) => {
    setPublicComments(next);
    writeStorageList(storage.public, next);
  };

  const persistPersonal = (next: PersonalRecord[]) => {
    setPersonalRecords(next);
    writeStorageList(storage.personal, next);
  };

  const persistFavorites = (next: FavoriteComment[]) => {
    setFavoriteComments(next);
    writeStorageList(storage.favorites, next);
  };

  const publicContentOf = (record: PersonalRecord) => record.summary || record.content;
  const publicTitleOf = (record: PersonalRecord) => record.summaryTitle;

  const refreshFavoriteCopies = (comment: PublicComment) => {
    persistFavorites(favoriteComments.map(item => (
      item.id === comment.id ? { ...item, ...comment } : item
    )));
  };

  const removeFavoriteCopy = (commentId: string) => {
    persistFavorites(favoriteComments.filter(item => item.id !== commentId));
  };

  const publishText = () => {
    const content = text.trim();
    if (!content) return;
    const now = new Date().toISOString();
    const record: PersonalRecord = {
      id: `record-${Date.now()}`,
      kind: 'comment',
      content,
      createdAt: now,
      visibility: activeTab === 'public' ? 'public' : 'private',
      publisher: CURRENT_USER,
      publishedAt: activeTab === 'public' ? now : undefined
    };
    persistPersonal([record, ...personalRecords]);
    if (record.visibility === 'public') {
      persistPublic([{
        id: `public-${record.id}`,
        sourceRecordId: record.id,
        author: CURRENT_USER,
        owner: 'me',
        content,
        createdAt: now
      }, ...publicComments]);
    }
    setText('');
  };

  const publishPersonalRecord = (record: PersonalRecord) => {
    if (record.visibility === 'public') return;
    const publishedAt = new Date().toISOString();
    const nextComment: PublicComment = {
      id: `public-${record.id}`,
      sourceRecordId: record.id,
      author: CURRENT_USER,
      owner: 'me',
      summaryTitle: publicTitleOf(record),
      content: publicContentOf(record),
      createdAt: publishedAt
    };
    persistPersonal(personalRecords.map(item => (
      item.id === record.id ? { ...item, visibility: 'public', publisher: CURRENT_USER, publishedAt } : item
    )));
    persistPublic([nextComment, ...publicComments]);
  };

  const revokePublicRecord = (record: PersonalRecord) => {
    persistPersonal(personalRecords.map(item => (
      item.id === record.id ? { ...item, visibility: 'private', publishedAt: undefined } : item
    )));
    const publicItem = publicComments.find(item => item.sourceRecordId === record.id);
    persistPublic(publicComments.filter(item => item.sourceRecordId !== record.id));
    if (publicItem) removeFavoriteCopy(publicItem.id);
  };

  const deletePersonalRecord = (record: PersonalRecord) => {
    const publicItem = publicComments.find(item => item.sourceRecordId === record.id);
    persistPersonal(personalRecords.filter(item => item.id !== record.id));
    persistPublic(publicComments.filter(item => item.sourceRecordId !== record.id));
    if (publicItem) removeFavoriteCopy(publicItem.id);
  };

  const revokePublicComment = (comment: PublicComment) => {
    if (comment.sourceRecordId) {
      persistPersonal(personalRecords.map(item => (
        item.id === comment.sourceRecordId ? { ...item, visibility: 'private', publishedAt: undefined } : item
      )));
    }
    persistPublic(publicComments.filter(item => item.id !== comment.id));
    removeFavoriteCopy(comment.id);
  };

  const deletePublicComment = (comment: PublicComment) => {
    if (comment.sourceRecordId) {
      persistPersonal(personalRecords.filter(item => item.id !== comment.sourceRecordId));
    }
    persistPublic(publicComments.filter(item => item.id !== comment.id));
    removeFavoriteCopy(comment.id);
  };

  const startEditRecord = (record: PersonalRecord) => {
    setEditingRecordId(record.id);
    setEditingPublicId(undefined);
    setEditTitleDraft(record.summaryTitle || '');
    setEditContentDraft(record.summary || record.content || '');
  };

  const saveRecordEdit = (record: PersonalRecord) => {
    const nextTitle = editTitleDraft.trim();
    const nextContent = editContentDraft.trim();
    const nextRecords = personalRecords.map(item => (
      item.id === record.id
        ? {
          ...item,
          content: item.kind === 'comment' ? nextContent : item.content,
          summaryTitle: item.kind === 'audio' || nextTitle ? nextTitle : undefined,
          summary: item.kind === 'audio' || nextTitle ? nextContent : item.summary
        }
        : item
    ));
    persistPersonal(nextRecords);
    if (record.visibility === 'public') {
      const nextComment = publicComments.find(item => item.sourceRecordId === record.id);
      if (nextComment) {
        const updated = {
          ...nextComment,
          summaryTitle: nextTitle || undefined,
          content: nextContent || record.content
        };
        persistPublic(publicComments.map(item => item.id === nextComment.id ? updated : item));
        refreshFavoriteCopies(updated);
      }
    }
    setEditingRecordId(undefined);
  };

  const startEditPublic = (comment: PublicComment) => {
    setEditingPublicId(comment.id);
    setEditingRecordId(undefined);
    setEditTitleDraft(comment.summaryTitle || '');
    setEditContentDraft(comment.content);
  };

  const savePublicEdit = (comment: PublicComment) => {
    const nextTitle = editTitleDraft.trim();
    const nextContent = editContentDraft.trim();
    const updated: PublicComment = {
      ...comment,
      summaryTitle: nextTitle || undefined,
      content: nextContent || comment.content
    };
    persistPublic(publicComments.map(item => item.id === comment.id ? updated : item));
    if (comment.sourceRecordId) {
      persistPersonal(personalRecords.map(item => (
        item.id === comment.sourceRecordId
          ? {
            ...item,
            content: item.kind === 'comment' ? updated.content : item.content,
            summaryTitle: updated.summaryTitle,
            summary: item.kind === 'audio' || updated.summaryTitle ? updated.content : item.summary
          }
          : item
      )));
    }
    refreshFavoriteCopies(updated);
    setEditingPublicId(undefined);
  };

  const createAudioRecord = (duration: number, summary?: string, summaryTitle?: string, audioUrl?: string) => {
    const record: PersonalRecord = {
      id: `record-${Date.now()}`,
      kind: 'audio',
      content: `录音记录 ${Math.max(1, duration)}s`,
      createdAt: new Date().toISOString(),
      visibility: 'private',
      publisher: CURRENT_USER,
      duration: Math.max(1, duration),
      audioUrl,
      summary,
      summaryTitle
    };
    persistPersonal([record, ...personalRecords]);
    setActiveTab('personal');
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      createAudioRecord(18);
      message.info('当前浏览器未开放录音权限，已生成一条演示录音。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      const startedAt = Date.now();
      mediaRecorderRef.current = recorder;
      setRecordStartedAt(startedAt);
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        createAudioRecord(Math.round((Date.now() - startedAt) / 1000), undefined, undefined, URL.createObjectURL(blob));
        setRecording(false);
        setRecordStartedAt(undefined);
      };
      recorder.start();
      setRecording(true);
    } catch {
      message.warning('未获得麦克风权限，无法开始录音。');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const summarizeRecord = (record: PersonalRecord) => {
    const next = createSummary(chartTitle);
    persistPersonal(personalRecords.map(item => (
      item.id === record.id ? { ...item, ...next } : item
    )));
    message.success('已生成AI总结。');
  };

  const toggleFavorite = (comment: PublicComment) => {
    if (favoriteComments.some(item => item.id === comment.id)) {
      persistFavorites(favoriteComments.filter(item => item.id !== comment.id));
      return;
    }
    persistFavorites([{ ...comment, favoritedAt: new Date().toISOString() }, ...favoriteComments]);
  };

  const filteredPublicComments = publicComments
    .filter(item => inTimeRange(item.createdAt, timeRange))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const toggleExpanded = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const renderPublicItem = (item: PublicComment, favoriteTab = false) => {
    const expanded = favoriteTab ? expandedFavoriteIds.includes(item.id) : expandedPublicIds.includes(item.id);
    const favorited = favoriteComments.some(comment => comment.id === item.id);
    const editing = editingPublicId === item.id;
    return (
      <div key={item.id} className="chart-comment-item">
        <div className="chart-comment-meta">
          <span>{item.author}</span>
          <span>{formatTime(item.createdAt)}</span>
        </div>
        {editing ? (
          <div className="chart-summary-editor">
            <Input
              value={editTitleDraft}
              onChange={event => setEditTitleDraft(event.target.value)}
              placeholder="标题"
            />
            <Input.TextArea
              value={editContentDraft}
              onChange={event => setEditContentDraft(event.target.value)}
              autoSize={{ minRows: 2, maxRows: 4 }}
              placeholder="内容"
            />
            <Space>
              <Button size="small" type="primary" onClick={() => savePublicEdit(item)}>保存</Button>
              <Button size="small" onClick={() => setEditingPublicId(undefined)}>取消</Button>
            </Space>
          </div>
        ) : (
          <>
            {item.summaryTitle ? <div className="chart-comment-title">{item.summaryTitle}</div> : null}
            <div className={`chart-comment-content${expanded ? '' : ' is-clamped'}`}>{item.content}</div>
            <button
              type="button"
              className="chart-expand-corner"
              onClick={() => toggleExpanded(item.id, favoriteTab ? setExpandedFavoriteIds : setExpandedPublicIds)}
            >
              {expanded ? '收起' : '展开'}
            </button>
          </>
        )}
        <div className="chart-record-actions chart-record-actions-public">
          <Button
            size="small"
            icon={favorited ? <StarFilled /> : <StarOutlined />}
            onClick={() => toggleFavorite(item)}
          >
            {favorited ? '已收藏' : '收藏'}
          </Button>
          {item.owner === 'me' ? (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => startEditPublic(item)}>编辑</Button>
              <Button size="small" icon={<LockOutlined />} onClick={() => revokePublicComment(item)}>撤销</Button>
              <Popconfirm
                title="确认删除这条内容吗？"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => deletePublicComment(item)}
              >
                <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </>
          ) : favoriteTab ? (
            <Button size="small" onClick={() => toggleFavorite(item)}>取消收藏</Button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <aside className="chart-collaboration-panel">
      <div className="chart-collaboration-head">
        <span>交流记录</span>
        <Segmented
          size="small"
          value={activeTab}
          options={[
            { label: '评论区', value: 'public' },
            { label: '我的记录', value: 'personal' },
            { label: '我的收藏', value: 'favorites' }
          ]}
          onChange={value => setActiveTab(value as TabKey)}
        />
      </div>

      <div className="chart-comment-filter">
        {activeTab === 'public' ? (
          <DatePicker.RangePicker
            size="small"
            allowClear
            value={timeRange}
            presets={[
              { label: '最近7天', value: [dayjs().subtract(7, 'day'), dayjs()] },
              { label: '最近30天', value: [dayjs().subtract(30, 'day'), dayjs()] }
            ]}
            onChange={values => setTimeRange(values)}
          />
        ) : null}
      </div>

      <div className="chart-record-history">
        {activeTab === 'public' ? (
          filteredPublicComments.length > 0
            ? filteredPublicComments.map(item => renderPublicItem(item))
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无公共内容" />
        ) : null}

        {activeTab === 'favorites' ? (
          favoriteComments.length > 0
            ? favoriteComments.map(item => renderPublicItem(item, true))
            : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无收藏内容" />
        ) : null}

        {activeTab === 'personal' ? (
          personalRecords.length > 0 ? personalRecords.map(item => {
            const expanded = expandedPersonalIds.includes(item.id);
            const editing = editingRecordId === item.id;
            return (
              <div key={item.id} className="chart-comment-item">
                <div className="chart-comment-meta">
                  <span>{item.kind === 'audio' ? '录音' : '记录'}</span>
                  <span>{formatTime(item.createdAt)}</span>
                </div>
                <div className="chart-record-publish-meta">
                  <span>发布人：{item.publisher || CURRENT_USER}</span>
                  <span>发布时间：{item.publishedAt ? formatTime(item.publishedAt) : '未发布'}</span>
                </div>
                <div className={`chart-comment-content${expanded ? '' : ' is-clamped'}`}>
                  {item.kind === 'audio' ? <span><SoundOutlined /> {item.content}</span> : item.content}
                </div>
                {item.audioUrl ? <audio className="chart-record-audio" controls src={item.audioUrl} /> : null}
                {editing ? (
                  <div className="chart-summary-editor">
                    <Input
                      value={editTitleDraft}
                      onChange={event => setEditTitleDraft(event.target.value)}
                      placeholder="标题"
                    />
                    <Input.TextArea
                      value={editContentDraft}
                      onChange={event => setEditContentDraft(event.target.value)}
                      autoSize={{ minRows: 2, maxRows: 4 }}
                      placeholder="内容"
                    />
                    <Space>
                      <Button size="small" type="primary" onClick={() => saveRecordEdit(item)}>保存</Button>
                      <Button size="small" onClick={() => setEditingRecordId(undefined)}>取消</Button>
                    </Space>
                  </div>
                ) : item.summary ? (
                  <div className="chart-recording-summary">
                    <strong>{item.summaryTitle}</strong>
                    <span className={expanded ? '' : 'is-clamped'}>{item.summary}</span>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="chart-expand-corner"
                  onClick={() => toggleExpanded(item.id, setExpandedPersonalIds)}
                >
                  {expanded ? '收起' : '展开'}
                </button>
                <div className="chart-record-actions">
                  {item.kind === 'audio' ? (
                    <Button size="small" onClick={() => summarizeRecord(item)}>AI总结</Button>
                  ) : <span />}
                  <Button size="small" onClick={() => startEditRecord(item)}>编辑</Button>
                  {item.visibility === 'public' ? (
                    <Button size="small" icon={<LockOutlined />} onClick={() => revokePublicRecord(item)}>撤销</Button>
                  ) : (
                    <Button size="small" type="primary" icon={<UnlockOutlined />} onClick={() => publishPersonalRecord(item)}>公开</Button>
                  )}
                  <Popconfirm
                    title="确认删除这条记录吗？"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deletePersonalRecord(item)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </div>
              </div>
            );
          }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无个人记录" />
        ) : null}
      </div>

      <div className="chart-record-compose">
        <Segmented
          size="small"
          value={inputMode}
          options={[
            { label: '输入', value: 'comment' },
            { label: '录音', value: 'audio' }
          ]}
          onChange={value => setInputMode(value as RecordKind)}
        />
        {inputMode === 'comment' ? (
          <div className="chart-comment-compose">
            <Input.TextArea
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder={activeTab === 'public' ? '发布到公共空间' : '保存到我的记录'}
              autoSize={false}
            />
            <Button type="primary" icon={<SendOutlined />} onClick={publishText}>
              {activeTab === 'public' ? '发布' : '保存'}
            </Button>
          </div>
        ) : (
          <div className="chart-audio-compose">
            <Tag color="gold">录音只保存到我的记录</Tag>
            {recording ? (
              <Button danger icon={<PauseCircleOutlined />} onClick={stopRecording}>停止录音</Button>
            ) : (
              <Button icon={<AudioOutlined />} onClick={startRecording}>开始录音</Button>
            )}
            {recording && recordStartedAt ? (
              <span className="chart-recording-live">
                {Math.max(1, Math.round((Date.now() - recordStartedAt) / 1000))}s
              </span>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
