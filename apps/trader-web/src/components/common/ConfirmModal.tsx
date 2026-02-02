import React from 'react'
import { Modal, Button } from '@douyinfe/semi-ui-19'
import { IconAlertTriangle } from '@douyinfe/semi-icons'

interface ConfirmModalProps {
  visible: boolean
  title?: string
  content: React.ReactNode
  confirmText?: string
  cancelText?: string
  confirmType?: 'primary' | 'danger' | 'warning'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title = '确认操作',
  content,
  confirmText = '确认',
  cancelText = '取消',
  confirmType = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const getConfirmButtonType = () => {
    switch (confirmType) {
      case 'danger':
        return 'danger'
      case 'warning':
        return 'warning'
      default:
        return 'primary'
    }
  }

  return (
    <Modal
      visible={visible}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {confirmType === 'danger' && (
            <IconAlertTriangle style={{ color: 'var(--semi-color-danger)' }} />
          )}
          {confirmType === 'warning' && (
            <IconAlertTriangle style={{ color: 'var(--semi-color-warning)' }} />
          )}
          {title}
        </div>
      }
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            theme="solid"
            type={getConfirmButtonType()}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      {content}
    </Modal>
  )
}
