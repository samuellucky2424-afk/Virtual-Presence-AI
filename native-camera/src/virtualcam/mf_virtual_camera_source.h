#pragma once

#include <unknwn.h>

namespace surevideotool::virtualcam
{
    bool CanUnloadMfModule() noexcept;
    HRESULT CreateMfClassFactory(REFCLSID classId, REFIID interfaceId, void** object) noexcept;
}
